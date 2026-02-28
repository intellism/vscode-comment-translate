/**
 * Markdown document translation parser.
 *
 * Uses marked lexer to parse markdown into tokens, extracts only translatable
 * text tokens, sends them for batch translation, then reconstructs the document
 * by replacing text tokens in the original source while preserving all
 * non-translatable content (code blocks, inline code, math, HTML, tables
 * structure, links, images, etc.) exactly as-is.
 *
 * The output keeps the exact same line count and structural formatting as the
 * source so that VS Code's built-in markdown preview can synchronise scroll
 * position between the source and the translated virtual document.
 */

import { marked } from "marked";

// ── Bold initial letter handling ─────────────────────────────────────────

/**
 * Regex that detects a "bold initial letter" pattern such as `**T**his`.
 * Group 1 = the bold letter, Group 2 = the rest of the word.
 */
const BOLD_INITIAL_RE = /^\*\*([A-Za-z])\*\*(\S)/;

/**
 * Strip bold-initial-letter formatting so the translator sees the full word.
 * e.g. `**T**his is great` → `This is great`
 */
export function stripBoldInitial(text: string): { stripped: string; letter: string | null } {
    const match = text.match(BOLD_INITIAL_RE);
    if (match) {
        const letter = match[1];
        const rest = text.replace(BOLD_INITIAL_RE, `${letter}${match[2]}`);
        return { stripped: rest, letter };
    }
    return { stripped: text, letter: null };
}

/**
 * Re-apply bold-initial-letter formatting after translation.
 */
export function restoreBoldInitial(translated: string, _originalLetter: string | null): string {
    if (_originalLetter === null || translated.length === 0) {
        return translated;
    }
    const firstChar = translated[0];
    if (/[A-Za-z\u4e00-\u9fff]/.test(firstChar)) {
        return `**${firstChar}**${translated.slice(1)}`;
    }
    return translated;
}

// ── Inline placeholder handling (kept for backward compatibility) ─────────

interface PlaceholderEntry {
    placeholder: string;
    original: string;
}

/**
 * Replace inline non-translatable tokens with placeholders.
 * Kept for backward compatibility with existing tests but no longer used
 * internally by the translation pipeline.
 */
export function replaceInlinePlaceholders(text: string): { cleaned: string; entries: PlaceholderEntry[] } {
    const entries: PlaceholderEntry[] = [];
    let index = 0;
    let result = text;

    function nextPlaceholder(original: string): string {
        const placeholder = `\u200B${index}\u200B`;
        entries.push({ placeholder, original });
        index++;
        return placeholder;
    }

    result = result.replace(/`[^`]+`/g, (match) => nextPlaceholder(match));
    result = result.replace(/(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)/g, (match) => nextPlaceholder(match));
    result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, (match) => nextPlaceholder(match));
    result = result.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, linkText: string, url: string) => {
        const urlPlaceholder = nextPlaceholder(`](${url})`);
        return `[${linkText}${urlPlaceholder}`;
    });

    return { cleaned: result, entries };
}

/**
 * Restore placeholders back to their original inline tokens.
 */
export function restoreInlinePlaceholders(text: string, entries: PlaceholderEntry[]): string {
    let result = text;
    for (let i = entries.length - 1; i >= 0; i--) {
        const { placeholder, original } = entries[i];
        result = result.replace(placeholder, original);
    }
    return result;
}

// ── Line-level metadata ──────────────────────────────────────────────────

/** Represents a single line's translation disposition. */
export interface LineMeta {
    /** 0-based line index */
    lineIndex: number;
    /** Whether this line should be translated */
    translatable: boolean;
    /** The raw source line */
    raw: string;
    /**
     * For translatable lines: the text that should be sent to the translation
     * service (markdown formatting stripped of non-display tokens).
     * For non-translatable lines this equals `raw`.
     */
    textToTranslate: string;
    /** Prefix that precedes the translatable text (e.g. `"## "`, `"> "`, `"- "`) */
    prefix: string;
    /** Suffix that follows the translatable text (trailing whitespace, etc.) */
    suffix: string;
}

// ── Block-level regex patterns ───────────────────────────────────────────

const FENCED_CODE_OPEN_RE = /^(\s*)(```|~~~)(.*)$/;
const MATH_BLOCK_RE = /^\s*\$\$\s*$/;
const YAML_DELIMITER_RE = /^---\s*$/;
const HEADING_RE = /^(#{1,6}\s+)(.*?)(\s*)$/;
const BLOCKQUOTE_RE = /^(\s*>\s*)(.*?)(\s*)$/;
const UNORDERED_LIST_RE = /^(\s*[-*+]\s+)(.*?)(\s*)$/;
const ORDERED_LIST_RE = /^(\s*\d+\.\s+)(.*?)(\s*)$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const HTML_BLOCK_RE = /^\s*<\/?[a-zA-Z][^>]*>\s*$/;

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && !TABLE_SEPARATOR_RE.test(line);
}

function makeNonTranslatable(lineIndex: number, raw: string): LineMeta {
    return { lineIndex, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' };
}

// ── Inline text extraction using marked lexer ────────────────────────────

/**
 * Collect only the translatable text portions from inline content using
 * marked's inline lexer. Returns the concatenated translatable text and
 * a recipe for reconstructing the line after translation.
 *
 * The key insight: we use marked to tokenize inline content, then only
 * extract `text` tokens for translation. Code spans, inline math, images,
 * HTML tags etc. are left untouched.
 */
interface InlineSegment {
    /** The raw text as it appears in the source */
    raw: string;
    /** Whether this segment should be translated */
    translatable: boolean;
}

/**
 * Parse inline content into segments using marked's lexer.
 * Only `text` type tokens (and text within strong/em/link) are translatable.
 * Everything else (codespan, image, html, etc.) is preserved as-is.
 */
function parseInlineSegments(content: string): InlineSegment[] {
    if (!content || content.trim() === '') {
        return [{ raw: content, translatable: false }];
    }

    // Use marked.lexer to tokenize; it wraps inline content in a paragraph
    const tokens = marked.lexer(content, { gfm: true });
    if (tokens.length === 0) {
        return [{ raw: content, translatable: true }];
    }

    const segments: InlineSegment[] = [];

    function walkInlineTokens(tokenList: marked.Token[]) {
        for (const token of tokenList) {
            switch (token.type) {
                case 'text':
                    if (token.raw.trim()) {
                        segments.push({ raw: token.raw, translatable: true });
                    } else {
                        segments.push({ raw: token.raw, translatable: false });
                    }
                    break;
                case 'codespan':
                    segments.push({ raw: token.raw, translatable: false });
                    break;
                case 'image':
                    segments.push({ raw: token.raw, translatable: false });
                    break;
                case 'html':
                    segments.push({ raw: token.raw, translatable: false });
                    break;
                case 'link': {
                    // Treat the entire link as non-translatable to prevent URLs
                    // from being sent to the translation service (which can corrupt
                    // them, e.g. half-width "://" → full-width "：//").
                    segments.push({ raw: token.raw, translatable: false });
                    break;
                }
                case 'strong':
                case 'em': {
                    // Split strong/em into marker (non-translatable) + inner text
                    // (translatable) + marker (non-translatable). This prevents
                    // the markdown markers (**/**) from being sent to the
                    // translation service, which can corrupt them by inserting
                    // spaces (e.g. "**Causes:**" → "** 原因：**").
                    const formattedToken = token as marked.Tokens.Strong | marked.Tokens.Em;
                    const marker = token.type === 'strong' ? '**' : '*';
                    const hasTextContent = formattedToken.tokens &&
                        formattedToken.tokens.some((t: marked.Token) => t.type === 'text' && t.raw.trim());
                    if (hasTextContent) {
                        // Extract inner text (strip the markers)
                        const innerText = token.raw.slice(marker.length, token.raw.length - marker.length);
                        segments.push({ raw: marker, translatable: false });
                        segments.push({ raw: innerText, translatable: true });
                        segments.push({ raw: marker, translatable: false });
                    } else {
                        segments.push({ raw: token.raw, translatable: false });
                    }
                    break;
                }
                default:
                    // For unknown token types, check for text content
                    if ('text' in token && typeof (token as any).text === 'string' && (token as any).text.trim()) {
                        segments.push({ raw: token.raw, translatable: true });
                    } else {
                        segments.push({ raw: token.raw, translatable: false });
                    }
                    break;
            }
        }
    }

    // marked.lexer wraps inline content in a paragraph token
    const firstToken = tokens[0];
    if ('tokens' in firstToken && firstToken.tokens) {
        walkInlineTokens(firstToken.tokens);
    } else {
        // Fallback: treat the whole content as translatable
        return [{ raw: content, translatable: true }];
    }

    if (segments.length === 0) {
        return [{ raw: content, translatable: true }];
    }

    return segments;
}

/**
 * Extract translatable text from inline content.
 * Returns the text to translate (all translatable segments joined by \n)
 * and the segments for reconstruction.
 */
function extractInlineTranslatableText(content: string): {
    textToTranslate: string;
    segments: InlineSegment[];
    hasTranslatable: boolean;
} {
    const segments = parseInlineSegments(content);
    const translatableSegments = segments.filter(seg => seg.translatable);
    const nonTranslatableSegments = segments.filter(seg => !seg.translatable);

    if (translatableSegments.length === 0) {
        return { textToTranslate: '', segments, hasTranslatable: false };
    }

    // If there are no non-translatable segments (no inline code, images, etc.),
    // send the entire content as a single translatable unit. This preserves
    // inline formatting like **bold** and *italic* in the translation context,
    // and avoids splitting "**Multiple** words" into separate segments.
    if (nonTranslatableSegments.length === 0) {
        const wholeSegment: InlineSegment[] = [{ raw: content, translatable: true }];
        return { textToTranslate: content, segments: wholeSegment, hasTranslatable: true };
    }

    const textToTranslate = translatableSegments.map(seg => seg.raw).join('\n');
    return { textToTranslate, segments, hasTranslatable: true };
}

/**
 * Reconstruct inline content by replacing translatable segments with
 * translated text parts.
 */
function reconstructInlineContent(
    originalContent: string,
    segments: InlineSegment[],
    translatedParts: string[]
): string {
    let partIndex = 0;
    let result = originalContent;

    for (const segment of segments) {
        if (segment.translatable && partIndex < translatedParts.length) {
            const translatedPart = translatedParts[partIndex];
            partIndex++;
            // Replace the first occurrence of this segment's raw text
            result = result.replace(segment.raw, translatedPart);
        }
    }

    return result;
}

// ── Table row handling ───────────────────────────────────────────────────

/**
 * Parse a table row. Each cell is independently analyzed for translatable text.
 * The translatable texts from all cells are joined with \n for batch translation.
 */
function parseTableRow(raw: string, lineIndex: number): LineMeta & { cellSegments: { segments: InlineSegment[]; originalContent: string }[] } {
    const trimmed = raw.trim();
    const cells = trimmed.split('|').slice(1, -1);

    const cellSegments: { segments: InlineSegment[]; originalContent: string }[] = [];
    const translatableTexts: string[] = [];
    let hasAnyTranslatable = false;

    for (const cell of cells) {
        const cellContent = cell.trim();
        if (!cellContent) {
            cellSegments.push({ segments: [], originalContent: cellContent });
            translatableTexts.push('');
            continue;
        }

        const { textToTranslate, segments, hasTranslatable } = extractInlineTranslatableText(cellContent);
        cellSegments.push({ segments, originalContent: cellContent });

        if (hasTranslatable) {
            hasAnyTranslatable = true;
            translatableTexts.push(textToTranslate);
        } else {
            translatableTexts.push('');
        }
    }

    if (!hasAnyTranslatable) {
        return {
            ...makeNonTranslatable(lineIndex, raw),
            cellSegments,
        };
    }

    return {
        lineIndex,
        translatable: true,
        raw,
        textToTranslate: translatableTexts.join('\n'),
        prefix: '\x00TABLE_ROW\x00',
        suffix: '',
        cellSegments,
    };
}

/**
 * Reconstruct a table row by replacing translatable cell content.
 */
function reconstructTableRow(
    raw: string,
    translatedText: string,
    cellSegments: { segments: InlineSegment[]; originalContent: string }[]
): string {
    const translatedCells = translatedText.split('\n');
    const trimmed = raw.trim();
    const originalCells = trimmed.split('|').slice(1, -1);

    const reconstructedCells = originalCells.map((originalCell, cellIndex) => {
        const cellContent = originalCell.trim();
        const translatedCellText = cellIndex < translatedCells.length ? translatedCells[cellIndex] : '';
        const cellInfo = cellIndex < cellSegments.length ? cellSegments[cellIndex] : null;

        if (!cellContent || !translatedCellText.trim() || !cellInfo) {
            return originalCell;
        }

        const hasTranslatable = cellInfo.segments.some(seg => seg.translatable);
        if (!hasTranslatable) {
            return originalCell;
        }

        // Preserve original cell padding
        const leadingSpace = originalCell.match(/^(\s*)/)?.[1] || ' ';
        const trailingSpace = originalCell.match(/(\s*)$/)?.[1] || ' ';

        // Reconstruct cell content by replacing translatable segments
        const translatedParts = translatedCellText.split('\n');
        const reconstructedContent = reconstructInlineContent(
            cellInfo.originalContent,
            cellInfo.segments,
            translatedParts
        );

        return `${leadingSpace}${reconstructedContent}${trailingSpace}`;
    });

    const leadingWhitespace = raw.match(/^(\s*)/)?.[1] || '';
    return `${leadingWhitespace}|${reconstructedCells.join('|')}|`;
}

// ── Line-level parsing ───────────────────────────────────────────────────

// Store table cell segments alongside LineMeta for reconstruction
const tableRowCellSegments = new Map<number, { segments: InlineSegment[]; originalContent: string }[]>();
// Store inline segments for regular lines
const lineInlineSegments = new Map<number, InlineSegment[]>();

/**
 * Parse a full markdown document into per-line metadata describing which
 * lines are translatable and how to reconstruct them after translation.
 */
export function parseMarkdownLines(source: string): LineMeta[] {
    const lines = source.split('\n');
    const result: LineMeta[] = [];

    // Clear caches
    tableRowCellSegments.clear();
    lineInlineSegments.clear();

    let inFencedCode = false;
    let fenceMarker = '';
    let inMathBlock = false;
    let inYamlFrontMatter = false;
    let yamlFrontMatterEnded = false;
    let inHtmlBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];

        // ── YAML front matter ──
        if (i === 0 && YAML_DELIMITER_RE.test(raw) && !yamlFrontMatterEnded) {
            inYamlFrontMatter = true;
            result.push(makeNonTranslatable(i, raw));
            continue;
        }
        if (inYamlFrontMatter) {
            if (YAML_DELIMITER_RE.test(raw)) {
                inYamlFrontMatter = false;
                yamlFrontMatterEnded = true;
            }
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // ── Fenced code blocks ──
        if (!inFencedCode) {
            const fenceMatch = raw.match(FENCED_CODE_OPEN_RE);
            if (fenceMatch) {
                inFencedCode = true;
                fenceMarker = fenceMatch[2];
                result.push(makeNonTranslatable(i, raw));
                continue;
            }
        } else {
            const closingRe = new RegExp(`^\\s*${escapeRegExp(fenceMarker)}\\s*$`);
            if (closingRe.test(raw)) {
                inFencedCode = false;
                fenceMarker = '';
            }
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // ── Math blocks ──
        if (!inMathBlock && MATH_BLOCK_RE.test(raw)) {
            inMathBlock = true;
            result.push(makeNonTranslatable(i, raw));
            continue;
        }
        if (inMathBlock) {
            if (MATH_BLOCK_RE.test(raw)) {
                inMathBlock = false;
            }
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // ── HTML block-level tags ──
        if (HTML_BLOCK_RE.test(raw)) {
            const openTagMatch = raw.match(/^\s*<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*(?<!\/)>\s*$/);
            if (openTagMatch && !raw.includes(`</${openTagMatch[1]}`)) {
                inHtmlBlock = true;
            }
            const closeTagMatch = raw.match(/^\s*<\/([a-zA-Z][a-zA-Z0-9]*)>\s*$/);
            if (closeTagMatch) {
                inHtmlBlock = false;
            }
            result.push(makeNonTranslatable(i, raw));
            continue;
        }
        if (inHtmlBlock) {
            if (/<\/[a-zA-Z][a-zA-Z0-9]*>\s*$/.test(raw)) {
                inHtmlBlock = false;
            }
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // ── Table separator lines ──
        if (TABLE_SEPARATOR_RE.test(raw)) {
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // ── Empty / whitespace-only lines ──
        if (raw.trim() === '') {
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // ── Table data rows ──
        if (isTableRow(raw)) {
            const tableResult = parseTableRow(raw, i);
            tableRowCellSegments.set(i, tableResult.cellSegments);
            result.push({
                lineIndex: tableResult.lineIndex,
                translatable: tableResult.translatable,
                raw: tableResult.raw,
                textToTranslate: tableResult.textToTranslate,
                prefix: tableResult.prefix,
                suffix: tableResult.suffix,
            });
            continue;
        }

        // ── Extract prefix and content for structured lines ──
        let prefix = '';
        let content = raw;
        let suffix = '';

        const headingMatch = raw.match(HEADING_RE);
        if (headingMatch) {
            prefix = headingMatch[1];
            content = headingMatch[2];
            suffix = headingMatch[3];
        } else if (BLOCKQUOTE_RE.test(raw)) {
            const bqMatch = raw.match(BLOCKQUOTE_RE)!;
            prefix = bqMatch[1];
            content = bqMatch[2];
            suffix = bqMatch[3];
            if (content.trim() === '') {
                result.push(makeNonTranslatable(i, raw));
                continue;
            }
        } else if (UNORDERED_LIST_RE.test(raw)) {
            const ulMatch = raw.match(UNORDERED_LIST_RE)!;
            prefix = ulMatch[1];
            content = ulMatch[2];
            suffix = ulMatch[3];
        } else if (ORDERED_LIST_RE.test(raw)) {
            const olMatch = raw.match(ORDERED_LIST_RE)!;
            prefix = olMatch[1];
            content = olMatch[2];
            suffix = olMatch[3];
        } else {
            const trailingMatch = raw.match(/^(.*?)(\s*)$/);
            content = trailingMatch ? trailingMatch[1] : raw;
            suffix = trailingMatch ? trailingMatch[2] : '';
        }

        // Handle bold initial letter BEFORE marked lexer parsing
        // so that marked sees "This is..." instead of "**T**his is..."
        const { stripped: strippedContent, letter: boldLetter } = stripBoldInitial(content);
        const contentForParsing = boldLetter !== null ? strippedContent : content;

        // Use marked inline lexer to extract translatable text
        const { textToTranslate, segments, hasTranslatable } = extractInlineTranslatableText(contentForParsing);

        if (!hasTranslatable) {
            result.push(makeNonTranslatable(i, raw));
            continue;
        }

        // Store segments for reconstruction
        lineInlineSegments.set(i, segments);

        const finalPrefix = boldLetter !== null ? prefix + '\x00BOLD_INITIAL\x00' : prefix;

        result.push({
            lineIndex: i,
            translatable: true,
            raw,
            textToTranslate,
            prefix: finalPrefix,
            suffix,
        });
    }

    return result;
}

/**
 * Extract all translatable texts from parsed line metadata.
 */
export function extractTranslatableTexts(lineMetas: LineMeta[]): string[] {
    return lineMetas.filter(meta => meta.translatable).map(meta => meta.textToTranslate);
}

/**
 * Reconstruct the full translated document from line metadata and translated texts.
 */
export function reconstructDocument(lineMetas: LineMeta[], translatedTexts: string[]): string {
    let translatedIndex = 0;
    const outputLines: string[] = [];

    for (const meta of lineMetas) {
        if (!meta.translatable) {
            outputLines.push(meta.raw);
            continue;
        }

        const translated = translatedTexts[translatedIndex++];
        if (translated === undefined) {
            outputLines.push(meta.raw);
            continue;
        }

        // Handle table rows
        if (meta.prefix === '\x00TABLE_ROW\x00') {
            const cellSegs = tableRowCellSegments.get(meta.lineIndex);
            if (cellSegs) {
                outputLines.push(reconstructTableRow(meta.raw, translated, cellSegs));
            } else {
                // Fallback: simple cell replacement
                const translatedCells = translated.split('\n');
                const trimmed = meta.raw.trim();
                const originalCells = trimmed.split('|').slice(1, -1);
                const reconstructedCells = originalCells.map((originalCell, cellIndex) => {
                    const originalPadding = originalCell.match(/^(\s*)/)?.[1] || ' ';
                    const originalTrailing = originalCell.match(/(\s*)$/)?.[1] || ' ';
                    const translatedCell = cellIndex < translatedCells.length ? translatedCells[cellIndex] : originalCell.trim();
                    return `${originalPadding}${translatedCell}${originalTrailing}`;
                });
                const leadingWhitespace = meta.raw.match(/^(\s*)/)?.[1] || '';
                outputLines.push(`${leadingWhitespace}|${reconstructedCells.join('|')}|`);
            }
            continue;
        }

        // Handle bold initial
        let prefix = meta.prefix;
        let finalTranslated = translated;
        if (prefix.includes('\x00BOLD_INITIAL\x00')) {
            prefix = prefix.replace('\x00BOLD_INITIAL\x00', '');
            finalTranslated = restoreBoldInitial(translated, 'x');
        }

        // Handle regular lines with inline segments
        const segments = lineInlineSegments.get(meta.lineIndex);
        if (segments) {
            const translatedParts = finalTranslated.split('\n');

            // For bold initial lines, the segments were parsed from the stripped
            // content (without **X**), so we must reconstruct from stripped content
            // and the result already has bold initial restored via restoreBoldInitial
            const isBoldInitial = meta.prefix.includes('\x00BOLD_INITIAL\x00') ||
                (prefix !== meta.prefix); // prefix was already cleaned
            if (isBoldInitial) {
                // Segments are based on stripped content; reconstruct from stripped
                const rawWithoutOrigPrefix = meta.raw.slice(
                    meta.prefix.replace('\x00BOLD_INITIAL\x00', '').length
                );
                const strippedRaw = stripBoldInitial(rawWithoutOrigPrefix).stripped;
                const contentEnd = meta.suffix ? strippedRaw.length - meta.suffix.length : strippedRaw.length;
                const strippedContent = strippedRaw.slice(0, contentEnd);

                const reconstructedContent = reconstructInlineContent(strippedContent, segments, translatedParts);
                outputLines.push(`${prefix}${reconstructedContent}${meta.suffix}`);
            } else {
                // Extract the content portion (between prefix and suffix)
                const rawWithoutPrefix = meta.raw.startsWith(prefix) ? meta.raw.slice(prefix.length) : meta.raw;
                const contentEnd = meta.suffix ? rawWithoutPrefix.length - meta.suffix.length : rawWithoutPrefix.length;
                const originalContent = rawWithoutPrefix.slice(0, contentEnd);

                const reconstructedContent = reconstructInlineContent(originalContent, segments, translatedParts);
                outputLines.push(`${prefix}${reconstructedContent}${meta.suffix}`);
            }
        } else {
            outputLines.push(`${prefix}${finalTranslated}${meta.suffix}`);
        }
    }

    return outputLines.join('\n');
}

/**
 * High-level function: translate a full markdown document.
 *
 * @param source The raw markdown source text
 * @param translateFn A function that translates a multi-line string and returns
 *                    the translated string with the same number of lines.
 * @returns The translated markdown document with identical line count and formatting.
 */
export async function translateMarkdownDocument(
    source: string,
    translateFn: (text: string) => Promise<string>
): Promise<string> {
    const lineMetas = parseMarkdownLines(source);
    const translatableTexts = extractTranslatableTexts(lineMetas);

    if (translatableTexts.length === 0) {
        return source;
    }

    // Each translatable text may contain \n (e.g. table rows with multiple cells).
    // Record how many lines each entry occupies so we can correctly slice the
    // translated result back into per-entry chunks.
    const lineCounts = translatableTexts.map(text => text.split('\n').length);
    const totalLines = lineCounts.reduce((sum, count) => sum + count, 0);

    const joinedText = translatableTexts.join('\n');
    const translatedJoined = await translateFn(joinedText);
    let allTranslatedLines = translatedJoined.split('\n');

    // Pad or trim to match expected total line count
    while (allTranslatedLines.length < totalLines) {
        allTranslatedLines.push('');
    }
    if (allTranslatedLines.length > totalLines) {
        allTranslatedLines = allTranslatedLines.slice(0, totalLines);
    }

    // Slice translated lines back into per-entry chunks, re-joining with \n
    const translatedTexts: string[] = [];
    let offset = 0;
    for (const count of lineCounts) {
        const chunk = allTranslatedLines.slice(offset, offset + count);
        translatedTexts.push(chunk.join('\n'));
        offset += count;
    }

    return reconstructDocument(lineMetas, translatedTexts);
}

// ── Progressive translation support ──────────────────────────────────────

/**
 * CSS style block injected at the top of loading snapshots to animate the
 * spinner indicator. Uses a pure-CSS border-spinner with transparent background
 * so it blends with any VS Code theme.
 */
const LOADING_STYLE = `<style>
@keyframes ct-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.ct-loading {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  border: 2px solid transparent;
  border-top-color: var(--vscode-progressBar-background, #0078d4);
  border-left-color: var(--vscode-progressBar-background, #0078d4);
  border-radius: 50%;
  animation: ct-spin 0.8s linear infinite;
  vertical-align: middle;
  margin-left: 4px;
}
</style>\n\n`;

/** Inline HTML spinner appended to lines that are still being translated. */
const LOADING_INDICATOR = ' <span class="ct-loading"></span>';

/**
 * Build an initial loading snapshot for a markdown document.
 *
 * All translatable lines show the original source text with a spinning loading
 * indicator appended. Non-translatable lines (code blocks, math, YAML, etc.)
 * are returned as-is. A `<style>` block is prepended to power the CSS
 * animation.
 */
export function buildLoadingSnapshot(source: string): string {
    const lineMetas = parseMarkdownLines(source);
    const lines: string[] = [];
    let hasLoading = false;
    for (const meta of lineMetas) {
        if (meta.translatable) {
            lines.push(meta.raw + LOADING_INDICATOR);
            hasLoading = true;
        } else {
            lines.push(meta.raw);
        }
    }
    const body = lines.join('\n');
    return hasLoading ? LOADING_STYLE + body : body;
}

/**
 * Build a document snapshot for progressive translation.
 *
 * Lines whose translation is already available use the translated text;
 * lines still pending show the original source text with a loading indicator.
 */
function buildProgressiveSnapshot(
    lineMetas: LineMeta[],
    translatedTexts: (string | null)[],
): string {
    let translatedIndex = 0;
    const outputLines: string[] = [];
    let hasLoadingLines = false;

    for (const meta of lineMetas) {
        if (!meta.translatable) {
            outputLines.push(meta.raw);
            continue;
        }

        const translated = translatedTexts[translatedIndex++];

        if (translated !== null) {
            // Already translated – reconstruct the line
            if (meta.prefix === '\x00TABLE_ROW\x00') {
                const cellSegs = tableRowCellSegments.get(meta.lineIndex);
                if (cellSegs) {
                    outputLines.push(reconstructTableRow(meta.raw, translated, cellSegs));
                } else {
                    outputLines.push(meta.raw);
                }
            } else {
                let prefix = meta.prefix;
                let finalTranslated = translated;
                if (prefix.includes('\x00BOLD_INITIAL\x00')) {
                    prefix = prefix.replace('\x00BOLD_INITIAL\x00', '');
                    finalTranslated = restoreBoldInitial(translated, 'x');
                }
                const segments = lineInlineSegments.get(meta.lineIndex);
                if (segments) {
                    const translatedParts = finalTranslated.split('\n');
                    const isBoldInitial = meta.prefix.includes('\x00BOLD_INITIAL\x00') ||
                        (prefix !== meta.prefix);
                    if (isBoldInitial) {
                        const rawWithoutOrigPrefix = meta.raw.slice(
                            meta.prefix.replace('\x00BOLD_INITIAL\x00', '').length
                        );
                        const strippedRaw = stripBoldInitial(rawWithoutOrigPrefix).stripped;
                        const contentEnd = meta.suffix ? strippedRaw.length - meta.suffix.length : strippedRaw.length;
                        const strippedContent = strippedRaw.slice(0, contentEnd);
                        const reconstructedContent = reconstructInlineContent(strippedContent, segments, translatedParts);
                        outputLines.push(`${prefix}${reconstructedContent}${meta.suffix}`);
                    } else {
                        const rawWithoutPrefix = meta.raw.startsWith(prefix) ? meta.raw.slice(prefix.length) : meta.raw;
                        const contentEnd = meta.suffix ? rawWithoutPrefix.length - meta.suffix.length : rawWithoutPrefix.length;
                        const originalContent = rawWithoutPrefix.slice(0, contentEnd);
                        const reconstructedContent = reconstructInlineContent(originalContent, segments, translatedParts);
                        outputLines.push(`${prefix}${reconstructedContent}${meta.suffix}`);
                    }
                } else {
                    outputLines.push(`${prefix}${finalTranslated}${meta.suffix}`);
                }
            }
        } else {
            // Not yet translated – show original with loading indicator
            outputLines.push(meta.raw + LOADING_INDICATOR);
            hasLoadingLines = true;
        }
    }

    const body = outputLines.join('\n');
    return hasLoadingLines ? LOADING_STYLE + body : body;
}

/**
 * Translate a markdown document progressively in batches.
 *
 * Instead of waiting for the entire document to be translated before returning,
 * this function translates in batches and calls `onProgress` after each batch
 * with a snapshot of the document where translated lines show translations and
 * pending lines show the original text with a loading indicator.
 *
 * @param source       The raw markdown source text
 * @param translateFn  Translation function (same contract as translateMarkdownDocument)
 * @param onProgress   Called after each batch with the current document snapshot
 * @param batchSize    Number of translatable-text entries per batch (default 5)
 * @returns The fully translated document
 */
export async function translateMarkdownDocumentProgressive(
    source: string,
    translateFn: (text: string) => Promise<string>,
    onProgress: (snapshot: string) => void,
    batchSize: number = 5,
): Promise<string> {
    const lineMetas = parseMarkdownLines(source);
    const translatableTexts = extractTranslatableTexts(lineMetas);

    if (translatableTexts.length === 0) {
        return source;
    }

    // Each translatable text may span multiple lines (table rows with cells).
    const lineCounts = translatableTexts.map(text => text.split('\n').length);

    // Track per-entry translation results; null = not yet translated
    const translatedTexts: (string | null)[] = new Array(translatableTexts.length).fill(null);

    // Translate in batches
    for (let batchStart = 0; batchStart < translatableTexts.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, translatableTexts.length);
        const batchTexts = translatableTexts.slice(batchStart, batchEnd);
        const batchLineCounts = lineCounts.slice(batchStart, batchEnd);
        const batchTotalLines = batchLineCounts.reduce((sum, count) => sum + count, 0);

        const joinedBatch = batchTexts.join('\n');
        const translatedJoined = await translateFn(joinedBatch);
        let allTranslatedLines = translatedJoined.split('\n');

        // Pad or trim to match expected line count
        while (allTranslatedLines.length < batchTotalLines) {
            allTranslatedLines.push('');
        }
        if (allTranslatedLines.length > batchTotalLines) {
            allTranslatedLines = allTranslatedLines.slice(0, batchTotalLines);
        }

        // Distribute translated lines back to per-entry chunks
        let offset = 0;
        for (let i = batchStart; i < batchEnd; i++) {
            const count = lineCounts[i];
            const chunk = allTranslatedLines.slice(offset, offset + count);
            translatedTexts[i] = chunk.join('\n');
            offset += count;
        }

        // Emit progress snapshot after each batch (including the last one,
        // so the caller can update the preview before the final result)
        onProgress(buildProgressiveSnapshot(lineMetas, translatedTexts));
    }

    // All entries translated – build final document using the standard path
    const finalTexts = translatedTexts as string[];
    return reconstructDocument(lineMetas, finalTexts);
}
