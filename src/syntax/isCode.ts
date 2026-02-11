
import { INITIAL } from "vscode-textmate";

/**
 * Detect which lines in the given texts array are code.
 * Returns a boolean array where `true` means the corresponding line is code.
 */
export async function isCode(texts: string[], languageId: string, textMateService?: any): Promise<boolean[]> {
    if (!textMateService) {
        try {
            const { createComment } = require("./Comment");
            const comment = await createComment();
            if (comment) {
                textMateService = comment.textMateService;
            }
        } catch {
            return texts.map(() => false);
        }
    }

    if (!textMateService) return texts.map(() => false);

    const grammar = await textMateService.createGrammar(languageId);
    if (!grammar) {
        return texts.map(() => false);
    }

    return texts.map((text) => {
        return isCodeLine(grammar, text);
    });
}

// Regex to detect non-ASCII letters (CJK, Cyrillic, Arabic, etc.)
// If text contains these, it is very likely natural language, not code.
const NON_ASCII_LETTER_RE = /[^\x00-\x7F]/;

function isCodeLine(grammar: any, text: string): boolean {
    // Empty or very short text is not code
    if (!text || text.trim().length === 0) return false;

    // Non-English characters strongly indicate natural language
    if (NON_ASCII_LETTER_RE.test(text)) return false;

    const { tokens } = grammar.tokenizeLine(text, INITIAL);

    let codeScore = 0;
    let textScore = 0;
    let totalNonCommentLength = 0;
    let consecutiveVariableOther = 0;
    let maxConsecutiveVariableOther = 0;
    let codeStructureCount = 0;      // strong code signals (operators, terminators, brackets)

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const length = token.endIndex - token.startIndex;
        const tokenText = text.substring(token.startIndex, token.endIndex);
        const scopes = token.scopes;
        const deepestScope = scopes[scopes.length - 1];

        // Skip comment tokens entirely
        if (deepestScope.startsWith('comment') || deepestScope.startsWith('punctuation.definition.comment')) {
            continue;
        }

        // Skip whitespace for scoring but count length
        if (tokenText.trim().length === 0) {
            totalNonCommentLength += length;
            continue;
        }

        totalNonCommentLength += length;

        // --- Consecutive variable.other detection ---
        if (deepestScope.startsWith('variable.other.')) {
            consecutiveVariableOther++;
            maxConsecutiveVariableOther = Math.max(maxConsecutiveVariableOther, consecutiveVariableOther);
        } else if (tokenText.trim().length > 0) {
            consecutiveVariableOther = 0;
        }

        // --- Plain text pattern: only source.* scope ---
        // Token with only 1 scope = just the language root (source.ts etc), this is plain text
        if (scopes.length === 1 && scopes[0].startsWith('source.')) {
            textScore += length;
            continue;
        }

        // Token with 2 scopes: source.* + variable.other.* = plain text word
        if (scopes.length === 2 && scopes[0].startsWith('source.') && deepestScope.startsWith('variable.other.')) {
            textScore += length;
            continue;
        }

        // --- Handle string.quoted carefully ---
        // In natural text, apostrophes create false string.quoted tokens
        // e.g. "it's" → 's a test' gets parsed as string.quoted
        // Heuristic: if string content looks like natural word fragments, treat as text
        if (deepestScope.startsWith('string.quoted')) {
            // Check if the string content looks like natural language fragments
            // (contains spaces, looks like words rather than code identifiers)
            if (isNaturalTextString(tokenText)) {
                textScore += length;
                continue;
            }
        }

        // --- Handle punctuation.definition.string carefully ---
        // Apostrophes/quotes in natural text (contractions, quoted words)
        if (deepestScope.startsWith('punctuation.definition.string')) {
            // Don't count isolated quotes as code signal
            // They'll be judged by context (surrounding tokens)
            continue; // neutral - don't count toward either side
        }

        // --- Strong code signals ---
        if (deepestScope.startsWith('keyword.operator')
            || deepestScope.startsWith('keyword.control')
        ) {
            // Keywords are code-relevant but alone don't prove it's code
            // (natural text can contain "if", "for", etc.)
            if (scopes.length > 2) {
                codeScore += length;
            } else {
                codeScore += length * 0.3;
            }
            continue;
        }

        if (deepestScope.startsWith('storage')) {
            if (scopes.length > 2) {
                codeScore += length;
            } else {
                codeScore += length * 0.3;
            }
            continue;
        }

        if (deepestScope.startsWith('constant.numeric')
            || deepestScope.startsWith('constant.language')
        ) {
            codeScore += length;
            continue;
        }

        if (deepestScope.startsWith('support')) {
            codeScore += length;
            continue;
        }

        // Code structure punctuation
        if (deepestScope.startsWith('punctuation.terminator')
            || deepestScope.startsWith('punctuation.definition.block')
            || deepestScope.startsWith('punctuation.definition.parameters')
            || deepestScope.startsWith('punctuation.separator')
            || deepestScope.startsWith('punctuation.accessor')
            || deepestScope.startsWith('meta.brace')
        ) {
            codeScore += length;
            codeStructureCount++;
            continue;
        }

        // entity.name.function with deep scope = code
        if (deepestScope.startsWith('entity.name') && scopes.length > 2) {
            codeScore += length;
            continue;
        }

        // variable.language (this, self, etc.) with deep scope
        if (deepestScope.startsWith('variable.language') && scopes.length > 2) {
            codeScore += length;
            continue;
        }

        // Other meta.* scopes with depth > 2 count as weak code
        if (scopes.length > 2) {
            codeScore += length * 0.2;
        }
    }

    if (totalNonCommentLength === 0) return false;

    // --- Decision logic ---

    // If there are 2+ consecutive "variable.other" words, this is very likely natural text
    // e.g. "Communicate with webview" → each word is variable.other
    if (maxConsecutiveVariableOther >= 2 && codeStructureCount === 0) {
        return false;
    }

    // If text score dominates, it's natural language
    const totalScored = codeScore + textScore;
    if (totalScored === 0) return false;

    // Need at least one structural code element AND sufficient code ratio
    if (codeStructureCount === 0) return false;

    const codeRatio = codeScore / totalScored;
    return codeRatio >= 0.5;
}

/**
 * Check if a string token content looks like natural language rather than a code string literal.
 * Natural language strings contain spaces and word-like fragments.
 */
function isNaturalTextString(text: string): boolean {
    // Remove surrounding quotes if present
    const inner = text.replace(/^['"`]|['"`]$/g, '');
    // If it contains spaces, it's likely a natural language fragment
    // (e.g. "s a test" from "it's a test", or "hello world")
    if (inner.includes(' ')) return true;
    // Very short strings (1-2 chars) from contractions like "'s", "'t"
    if (inner.length <= 2) return true;
    return false;
}
