/**
 * Markdown document translation parser.
 *
 * Parses a full markdown document line-by-line, identifies translatable text
 * regions while preserving non-translatable blocks (YAML front matter, fenced
 * code blocks, math blocks, HTML blocks, inline code, inline math, etc.).
 *
 * The output keeps the exact same line count and structural formatting as the
 * source so that VS Code's built-in markdown preview can synchronise scroll
 * position between the source and the translated virtual document.
 */

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

/**
 * Regex that detects a "bold initial letter" pattern such as `**T**his`.
 * Group 1 = the bold letter, Group 2 = the rest of the word.
 */
const BOLD_INITIAL_RE = /^\*\*([A-Za-z])\*\*(\S)/;

/**
 * Strip bold-initial-letter formatting so the translator sees the full word.
 * e.g. `**T**his is great` → `This is great`
 * Returns `{ stripped, letter }` where `letter` is the bold character so it
 * can be re-applied after translation.
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
 * Takes the first character of the translated text and wraps it in `**X**`.
 */
export function restoreBoldInitial(translated: string, _originalLetter: string | null): string {
    if (_originalLetter === null || translated.length === 0) {
        return translated;
    }
    const firstChar = translated[0];
    // Only restore if the first character is a letter
    if (/[A-Za-z\u4e00-\u9fff]/.test(firstChar)) {
        return `**${firstChar}**${translated.slice(1)}`;
    }
    return translated;
}

// ── Inline placeholder handling ──────────────────────────────────────────

interface PlaceholderEntry {
    placeholder: string;
    original: string;
}

/**
 * Replace inline non-translatable tokens (inline code, inline math, images,
 * links-as-references) with placeholders so the translator does not touch them.
 * Returns the cleaned text and a list of placeholder→original mappings.
 */
export function replaceInlinePlaceholders(text: string): { cleaned: string; entries: PlaceholderEntry[] } {
    const entries: PlaceholderEntry[] = [];
    let index = 0;

    function nextPlaceholder(original: string): string {
        const placeholder = `\u200B${index}\u200B`;
        entries.push({ placeholder, original });
        index++;
        return placeholder;
    }

    let result = text;

    // Inline code: `...`
    result = result.replace(/`[^`]+`/g, (match) => nextPlaceholder(match));

    // Inline math: $...$  (but not $$)
    result = result.replace(/(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)/g, (match) => nextPlaceholder(match));

    // Images: ![alt](url "title")
    result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, (match) => nextPlaceholder(match));

    // Links: [text](url) — keep the text translatable, placeholder the url part
    // We handle this specially: replace the whole link syntax but keep text
    result = result.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, linkText, url) => {
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
    // Restore in reverse order to avoid index shifting issues
    for (let i = entries.length - 1; i >= 0; i--) {
        const { placeholder, original } = entries[i];
        result = result.replace(placeholder, original);
    }
    return result;
}

// ── Line-level parsing ───────────────────────────────────────────────────

/** Matches the opening of a fenced code block: ``` or ~~~ with optional language */
const FENCED_CODE_OPEN_RE = /^(\s*)(```|~~~)(.*)$/;

/** Matches a math block delimiter: $$ */
const MATH_BLOCK_RE = /^\s*\$\$\s*$/;

/** Matches YAML front matter delimiter */
const YAML_DELIMITER_RE = /^---\s*$/;

/** Matches a heading line: # ... */
const HEADING_RE = /^(#{1,6}\s+)(.*?)(\s*)$/;

/** Matches a blockquote line: > ... */
const BLOCKQUOTE_RE = /^(\s*>\s*)(.*?)(\s*)$/;

/** Matches an unordered list item: - ... or * ... or + ... */
const UNORDERED_LIST_RE = /^(\s*[-*+]\s+)(.*?)(\s*)$/;

/** Matches an ordered list item: 1. ... */
const ORDERED_LIST_RE = /^(\s*\d+\.\s+)(.*?)(\s*)$/;

/** Matches a table separator line: |---|---| */
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Matches an HTML block-level tag */
const HTML_BLOCK_RE = /^\s*<\/?[a-zA-Z][^>]*>\s*$/;

/**
 * Parse a full markdown document into per-line metadata describing which
 * lines are translatable and how to reconstruct them after translation.
 */
export function parseMarkdownLines(source: string): LineMeta[] {
    const lines = source.split('\n');
    const result: LineMeta[] = [];

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
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }
        if (inYamlFrontMatter) {
            if (YAML_DELIMITER_RE.test(raw)) {
                inYamlFrontMatter = false;
                yamlFrontMatterEnded = true;
            }
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }

        // ── Fenced code blocks ──
        if (!inFencedCode) {
            const fenceMatch = raw.match(FENCED_CODE_OPEN_RE);
            if (fenceMatch) {
                inFencedCode = true;
                fenceMarker = fenceMatch[2];
                result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
                continue;
            }
        } else {
            // Check for closing fence
            const closingRe = new RegExp(`^\\s*${escapeRegExp(fenceMarker)}\\s*$`);
            if (closingRe.test(raw)) {
                inFencedCode = false;
                fenceMarker = '';
            }
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }

        // ── Math blocks ──
        if (!inMathBlock && MATH_BLOCK_RE.test(raw)) {
            inMathBlock = true;
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }
        if (inMathBlock) {
            if (MATH_BLOCK_RE.test(raw)) {
                inMathBlock = false;
            }
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }

        // ── HTML block-level tags ──
        if (HTML_BLOCK_RE.test(raw)) {
            // Detect multi-line HTML blocks: <tag ...> without closing on same line
            const openTagMatch = raw.match(/^\s*<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*(?<!\/)>\s*$/);
            if (openTagMatch && !raw.includes(`</${openTagMatch[1]}`)) {
                inHtmlBlock = true;
            }
            const closeTagMatch = raw.match(/^\s*<\/([a-zA-Z][a-zA-Z0-9]*)>\s*$/);
            if (closeTagMatch) {
                inHtmlBlock = false;
            }
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }
        if (inHtmlBlock) {
            // Check if this line closes the HTML block
            if (/<\/[a-zA-Z][a-zA-Z0-9]*>\s*$/.test(raw)) {
                inHtmlBlock = false;
            }
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }

        // ── Table separator lines ──
        if (TABLE_SEPARATOR_RE.test(raw)) {
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }

        // ── Empty / whitespace-only lines ──
        if (raw.trim() === '') {
            result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            continue;
        }

        // ── Table data rows ──
        if (isTableRow(raw)) {
            const tableMeta = parseTableRow(raw, i);
            result.push(tableMeta);
            continue;
        }

        // ── Heading ──
        const headingMatch = raw.match(HEADING_RE);
        if (headingMatch) {
            const prefix = headingMatch[1];
            const content = headingMatch[2];
            const suffix = headingMatch[3];
            const { textToTranslate, adjustedPrefix, adjustedSuffix } = processTranslatableContent(content, prefix, suffix);
            result.push({ lineIndex: i, translatable: true, raw, textToTranslate, prefix: adjustedPrefix, suffix: adjustedSuffix });
            continue;
        }

        // ── Blockquote ──
        const blockquoteMatch = raw.match(BLOCKQUOTE_RE);
        if (blockquoteMatch) {
            const prefix = blockquoteMatch[1];
            const content = blockquoteMatch[2];
            const suffix = blockquoteMatch[3];
            if (content.trim() === '') {
                result.push({ lineIndex: i, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' });
            } else {
                const { textToTranslate, adjustedPrefix, adjustedSuffix } = processTranslatableContent(content, prefix, suffix);
                result.push({ lineIndex: i, translatable: true, raw, textToTranslate, prefix: adjustedPrefix, suffix: adjustedSuffix });
            }
            continue;
        }

        // ── Unordered list item ──
        const unorderedMatch = raw.match(UNORDERED_LIST_RE);
        if (unorderedMatch) {
            const prefix = unorderedMatch[1];
            const content = unorderedMatch[2];
            const suffix = unorderedMatch[3];
            const { textToTranslate, adjustedPrefix, adjustedSuffix } = processTranslatableContent(content, prefix, suffix);
            result.push({ lineIndex: i, translatable: true, raw, textToTranslate, prefix: adjustedPrefix, suffix: adjustedSuffix });
            continue;
        }

        // ── Ordered list item ──
        const orderedMatch = raw.match(ORDERED_LIST_RE);
        if (orderedMatch) {
            const prefix = orderedMatch[1];
            const content = orderedMatch[2];
            const suffix = orderedMatch[3];
            const { textToTranslate, adjustedPrefix, adjustedSuffix } = processTranslatableContent(content, prefix, suffix);
            result.push({ lineIndex: i, translatable: true, raw, textToTranslate, prefix: adjustedPrefix, suffix: adjustedSuffix });
            continue;
        }

        // ── Plain paragraph text ──
        const trailingMatch = raw.match(/^(.*?)(\s*)$/);
        const content = trailingMatch ? trailingMatch[1] : raw;
        const trailingSuffix = trailingMatch ? trailingMatch[2] : '';
        const { textToTranslate, adjustedPrefix, adjustedSuffix } = processTranslatableContent(content, '', trailingSuffix);
        result.push({ lineIndex: i, translatable: true, raw, textToTranslate, prefix: adjustedPrefix, suffix: adjustedSuffix });
    }

    return result;
}

/**
 * Process translatable content: handle bold initial letters and inline placeholders.
 */
function processTranslatableContent(content: string, prefix: string, suffix: string): {
    textToTranslate: string;
    adjustedPrefix: string;
    adjustedSuffix: string;
} {
    const { stripped, letter } = stripBoldInitial(content);
    if (letter !== null) {
        return {
            textToTranslate: stripped,
            adjustedPrefix: prefix + `\x00BOLD_INITIAL\x00`,
            adjustedSuffix: suffix,
        };
    }
    return {
        textToTranslate: content,
        adjustedPrefix: prefix,
        adjustedSuffix: suffix,
    };
}

/** Check if a line looks like a table data row */
function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && !TABLE_SEPARATOR_RE.test(line);
}

/** Parse a table row into translatable cells */
function parseTableRow(raw: string, lineIndex: number): LineMeta {
    // Table rows have translatable cell content
    // We extract cell texts, join with \n for translation, then reconstruct
    const trimmed = raw.trim();
    const cells = trimmed.split('|').slice(1, -1); // Remove leading/trailing empty from split
    const cellTexts = cells.map(cell => cell.trim());
    const hasTranslatable = cellTexts.some(text => text.length > 0);

    if (!hasTranslatable) {
        return { lineIndex, translatable: false, raw, textToTranslate: raw, prefix: '', suffix: '' };
    }

    return {
        lineIndex,
        translatable: true,
        raw,
        textToTranslate: cellTexts.join('\n'),
        prefix: '\x00TABLE_ROW\x00',
        suffix: '',
    };
}

/**
 * Given the parsed line metadata and an array of translated texts (one per
 * translatable line, in order), reconstruct the full translated document
 * preserving the original line count and formatting.
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
            const translatedCells = translated.split('\n');
            const originalTrimmed = meta.raw.trim();
            const originalCells = originalTrimmed.split('|').slice(1, -1);

            const reconstructedCells = originalCells.map((originalCell, cellIndex) => {
                const originalPadding = originalCell.match(/^(\s*)/)?.[1] || ' ';
                const originalTrailing = originalCell.match(/(\s*)$/)?.[1] || ' ';
                const translatedCell = cellIndex < translatedCells.length ? translatedCells[cellIndex] : originalCell.trim();
                return `${originalPadding}${translatedCell}${originalTrailing}`;
            });

            const leadingWhitespace = meta.raw.match(/^(\s*)/)?.[1] || '';
            outputLines.push(`${leadingWhitespace}|${reconstructedCells.join('|')}|`);
            continue;
        }

        // Handle bold initial
        let prefix = meta.prefix;
        let finalTranslated = translated;
        if (prefix.includes('\x00BOLD_INITIAL\x00')) {
            prefix = prefix.replace('\x00BOLD_INITIAL\x00', '');
            finalTranslated = restoreBoldInitial(translated, 'x'); // non-null triggers restore
        }

        outputLines.push(`${prefix}${finalTranslated}${meta.suffix}`);
    }

    return outputLines.join('\n');
}

/**
 * Extract all translatable texts from parsed line metadata.
 * These texts should be joined with `\n` and sent to the translation service
 * as a single batch (the service preserves line count).
 */
export function extractTranslatableTexts(lineMetas: LineMeta[]): string[] {
    return lineMetas.filter(meta => meta.translatable).map(meta => meta.textToTranslate);
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

    // Handle inline placeholders before sending to translation
    const placeholderMaps: PlaceholderEntry[][] = [];
    const textsForTranslation = translatableTexts.map(text => {
        const { cleaned, entries } = replaceInlinePlaceholders(text);
        placeholderMaps.push(entries);
        return cleaned;
    });

    const joinedText = textsForTranslation.join('\n');
    const translatedJoined = await translateFn(joinedText);
    let translatedLines = translatedJoined.split('\n');

    // Ensure we have the same number of lines
    while (translatedLines.length < textsForTranslation.length) {
        translatedLines.push('');
    }
    if (translatedLines.length > textsForTranslation.length) {
        translatedLines = translatedLines.slice(0, textsForTranslation.length);
    }

    // Restore inline placeholders
    const restoredTranslations = translatedLines.map((line, index) => {
        return restoreInlinePlaceholders(line, placeholderMaps[index] || []);
    });

    return reconstructDocument(lineMetas, restoredTranslations);
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
