// Keeps a comment's line structure when a translation source merges or splits lines.
// A translation source may return a different number of lines than it was given;
// normalizeTranslatedLines() maps such a result back onto the source lines.
// Complexity: O(n * lines) over the translated text (n = characters in the translation).
// Adapted from xyy0411/vscode-comment-translate (MIT), src/translate/lineBreakFallback.ts.

// Target width in characters when a merged translation is cut into lines again.
// Fixed width; could become a setting if users need a different one.
const PREFERRED_LINE_LENGTH = 80;

const CJK_BREAK = /[，。！？；：、]/;
const LATIN_BREAK = /[,.!?;:]/;
// Printable, non-space ASCII: the kind of character that glues a "." or ":" to the next token.
const GLUED = /[\x21-\x7e]/;

function isBlank(line: string): boolean {
    return line.trim().length === 0;
}

// Puts '' at every blank source line and the next translated line at every other one.
function insertBlankLines(sourceLines: string[], translatedLines: string[]): string[] {
    let next = 0;
    return sourceLines.map(line => isBlank(line) ? '' : (translatedLines[next++] || ''));
}

// True when the text may be cut between chars[index - 1] and chars[index].
// Latin punctuation only counts when it is not glued to the next token, so that
// "3.14", "v1.2" and "std::string" are preferably not cut in the middle.
function canBreakAt(chars: string[], index: number): boolean {
    const previous = chars[index - 1];
    if (/\s/.test(previous) || CJK_BREAK.test(previous)) {
        return true;
    }
    return LATIN_BREAK.test(previous) && !GLUED.test(chars[index]);
}

// Cut position (1..limit) closest to `desired`: first backwards down to 60 % of it, then forwards up to 125 %.
// Falls back to `desired` itself when no break mark is in range. `limit` keeps room for the remaining lines.
function findBreak(chars: string[], desired: number, limit: number): number {
    const min = Math.max(1, Math.floor(desired * 0.6));
    for (let index = desired; index >= min; index--) {
        if (canBreakAt(chars, index)) {
            return index;
        }
    }
    const max = Math.min(limit, Math.ceil(desired * 1.25));
    for (let index = desired + 1; index <= max; index++) {
        if (canBreakAt(chars, index)) {
            return index;
        }
    }
    return desired;
}

// Cuts `text` into one chunk per source line, each chunk proportional to the length of its source line.
// Works on code points so a surrogate pair is never cut in half.
function distribute(sourceLines: string[], text: string): string[] {
    const weights = sourceLines.map(line => Math.max(Array.from(line).length, 1));
    let remainingWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let rest = text;
    const chunks: string[] = [];

    for (let i = 0; i < sourceLines.length - 1; i++) {
        const chars = Array.from(rest);
        const slotsLeft = sourceLines.length - i;
        if (chars.length === 0) {
            chunks.push('');
        } else {
            const proportional = Math.round(chars.length * weights[i] / remainingWeight);
            // Keep lines near the preferred width unless the text is too long to fit that way.
            const desired = chars.length <= PREFERRED_LINE_LENGTH * slotsLeft
                ? Math.min(proportional, PREFERRED_LINE_LENGTH)
                : proportional;
            // Every remaining source line needs at least one character.
            const limit = Math.max(1, chars.length - (slotsLeft - 1));
            const breakAt = findBreak(chars, Math.min(Math.max(desired, 1), limit), limit);
            chunks.push(chars.slice(0, breakAt).join('').trim());
            rest = chars.slice(breakAt).join('').trim();
        }
        remainingWeight -= weights[i];
    }
    chunks.push(rest);
    return chunks;
}

/**
 * Maps a translation back onto the source lines. Always returns `sourceLines.length` lines.
 *  1. One translated line per non-blank source line: blank source lines are re-inserted.
 *  2. Same line count as the source (and no text on a blank source line): returned unchanged.
 *  3. Anything else (lines merged or split by the provider): all translated text is flattened and cut
 *     again into one chunk per non-blank source line, preferring breaks at whitespace or punctuation.
 * Rules 1 and 2 are tried on the text without trailing whitespace first, because a trailing newline
 * adds an empty last line that is not a translated line, then on the exact text (a translation that
 * mirrors a blank last source line ends with an empty line on purpose).
 */
export function normalizeTranslatedLines(sourceLines: string[], translatedText: string): string[] {
    const nonBlankSource = sourceLines.filter(line => !isBlank(line));
    if (nonBlankSource.length === 0) {
        return sourceLines.map(() => '');
    }

    const normalized = translatedText.replace(/\r\n?/g, '\n');
    const candidates = [normalized.replace(/\s+$/, ''), normalized].map(text => text.split('\n'));
    for (const translatedLines of candidates) {
        if (translatedLines.length === nonBlankSource.length) {
            return insertBlankLines(sourceLines, translatedLines);
        }
        // A translation that puts text on a blank source line did not keep the source layout (callers that
        // leave blank lines out of the request get a different count back), so it is not taken as-is.
        const keepsBlankLines = sourceLines.every((line, i) => !isBlank(line) || isBlank(translatedLines[i] ?? ''));
        if (translatedLines.length === sourceLines.length && keepsBlankLines) {
            return translatedLines;
        }
    }

    const flattened = normalized.replace(/\s+/g, ' ').trim();
    return insertBlankLines(sourceLines, distribute(nonBlankSource, flattened));
}
