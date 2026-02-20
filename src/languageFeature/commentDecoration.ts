import { compileBlock } from "../syntax/compile";
import {
    window,
    Selection,
    DecorationOptions,
    TextEditorDecorationType,
    TextDocument,
} from "vscode";
import { ctx } from "../extension";
import { usePlaceholderCodeLensProvider } from "./codelen";
import { ICommentBlock, ICommentToken, ITranslatedText } from "../interface";
import { getTextLength } from "../util/string";
import { cachedTranslate, translateManager } from "../translate/manager";

export class CommentDecoration {
    private _loading: boolean = true;
    private _desposed: boolean = false;
    private _loadingDecoration: TextEditorDecorationType;
    private _translatedDecoration: TextEditorDecorationType | undefined;
    private _contentDecorations: DecorationOptions[] = [];

    constructor(protected _block: ICommentBlock, private _currDocument: TextDocument, private _inplace: boolean = false) {
        this._loadingDecoration = window.createTextEditorDecorationType({
            after: {
                contentIconPath: ctx.asAbsolutePath("resources/icons/loading.svg"),
            },
        });
        this.reflash();
        this.translate();
    }

    get block() {
        return this._block;
    }

    editing(): boolean {
        let range = this._block.range;
        let selection = window.activeTextEditor?.selection;
        if (selection) {
            return range.intersection(selection) ? true : false;
        }
        return false;
    }

    private _getRstPrefixLen(line: string): number {
        let remaining = line;
        let consumed = 0;

        const leadingWhitespace = remaining.match(/^\s*/)?.[0] || '';
        consumed += leadingWhitespace.length;
        remaining = remaining.slice(leadingWhitespace.length);

        const bulletList = remaining.match(/^[-*+]\s+/);
        if (bulletList) {
            return consumed + bulletList[0].length;
        }

        const orderedList = remaining.match(/^\d+[.)]\s+/);
        if (orderedList) {
            return consumed + orderedList[0].length;
        }

        return consumed;
    }

    protected async _compile(): Promise<ITranslatedText | null> {
        let { tokens } = this._block;
        if (!tokens || tokens.length === 0) {
            const lines = this._block.comment.split('\n');
            const isRst = this._currDocument.languageId === 'restructuredtext' || this._currDocument.languageId === 'rst';
            const fallbackTokens: ICommentToken[] = lines.map((line) => {
                const ignoreStart = isRst
                    ? this._getRstPrefixLen(line)
                    : (line.match(/^\s*/)?.[0] || '').length;
                return {
                    text: line,
                    ignoreStart,
                    ignoreEnd: 0,
                };
            });

            const texts = fallbackTokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
                return text.slice(ignoreStart, text.length - ignoreEnd).trim();
            });

            const sourceText = texts.join('\n');
            const translatedText = sourceText.length > 0
                ? await cachedTranslate(sourceText, { to: translateManager.opts.to || 'en' })
                : '';

            const targetLines = translatedText.split('\n');
            let targets: string[];
            if (targetLines.length === lines.length) {
                targets = targetLines;
            } else if (targetLines.length === 1) {
                targets = [targetLines[0], ...new Array(Math.max(lines.length - 1, 0)).fill('')];
            } else {
                const merged = targetLines.join(' ').trim();
                targets = [merged, ...new Array(Math.max(lines.length - 1, 0)).fill('')];
            }

            this._block.tokens = fallbackTokens;

            return {
                translatedText,
                targets,
                texts,
                combined: [],
                translateLink: ''
            };
        }
        return compileBlock(this._block, this._currDocument.languageId);
    }

    // Translate commentblock text and set decorative content
    async translate() {
        let result: ITranslatedText | null = null;
        try {
            result = await this._compile();
        } catch (error) {
            console.error('[comment-translate] translate compile failed:', error);
        }

        let { tokens, range } = this._block;
        this._loading = false;

        if (!result || !tokens || tokens.length === 0) {
            this.reflash();
            return null;
        }

        let { targets, texts, combined, translatedText } = result;

        let targetIndex = 0;
        let tokensLength = tokens.length || 0;
        tokens.forEach((token, i) => {
            let { text, ignoreStart = 0, ignoreEnd = 0 } = token;
            const translateText = texts[i];
            let targetText = translateText.length > 0 ? targets[targetIndex++] : "";
            let offset = i === 0 ? range.start.character : 0;
            let originText = text.slice(ignoreStart, text.length - ignoreEnd);

            let combinedIndex = i;

            // No need to display decoration when translation is wrong
            if (this._inplace && translatedText) {
                this._contentDecorations.push({
                    range: new Selection(
                        range.start.line + combinedIndex,
                        offset + ignoreStart,
                        range.start.line + combinedIndex,
                        offset + text.length - ignoreEnd
                    ),
                    renderOptions: this.genrateDecorationOptions(targetText),
                });
                return;
            }

            for (let k = i + 1; k < tokensLength && combined[k]; k++) {
                combinedIndex = k;
            }

            if (targetText && targetText !== originText) {
                // Read text here will be more than blocks and need to be read throughout the document
                const showLine = Math.min(this._currDocument.lineCount - 1, range.start.line + combinedIndex + 1);
                let showLineLen = getTextLength(this._currDocument!.lineAt(showLine).text);
                let offsetText = this._currDocument!.lineAt(range.start.line + combinedIndex).text.substring(0, offset + ignoreStart);

                let gap = getTextLength(offsetText) - showLineLen;
                if (gap > 0) {
                    targetText = targetText.padStart(targetText.length + gap, '\u00a0');
                }
                this._contentDecorations.push({
                    range: new Selection(
                        range.start.line + combinedIndex + 1,
                        offset + ignoreStart,
                        range.start.line + combinedIndex + 1,
                        offset + text.length - ignoreEnd
                    ),
                    renderOptions: this.genrateDecorationOptions(targetText),
                });
            }
        });

        this.reflash();
    }

    // Generate the text decoration styles
    genrateDecorationOptions(text: string) {
        if (this._inplace) {
            return {
                before: {
                    color: `var(--vscode-editorCodeLens-foreground)`,
                    contentText: text,
                },
            };
        }
        return {
            before: {
                textDecoration: `none; font-size: 1em; display: inline-block; position: relative; width: 0; top: ${-1.3}em;`,
                contentText: text,
                color: 'var(--vscode-editorCodeLens-foreground)',
            },
        };
    }

    // Get the text decoration type
    getTranslatedDecoration() {
        if (this._translatedDecoration) {
            return this._translatedDecoration;
        }

        let textDecoration: string | undefined;
        if (this._inplace) {
            textDecoration = "none; display: none;";
        }
        this._translatedDecoration = window.createTextEditorDecorationType({
            textDecoration,
        });

        return this._translatedDecoration;
    }

    // 重新渲染装饰内容
    reflash() {
        if (this._desposed) return;
        const currentUri = this._currDocument.uri.toString();
        const targetEditors = window.visibleTextEditors.filter((editor) => {
            return editor.document.uri.toString() === currentUri;
        });

        if (targetEditors.length === 0) {
            return;
        }

        if (this._loading) {
            targetEditors.forEach((editor) => {
                editor.setDecorations(this._loadingDecoration, [
                    this._block.range,
                ]);
            });
            return;
        } else {
            targetEditors.forEach((editor) => {
                editor.setDecorations(this._loadingDecoration, []);
            });
        }

        let translatedDecoration = this.getTranslatedDecoration();
        // The current comment block is being edited, translation status is not displayed
        if (this._inplace && this.editing()) {
            targetEditors.forEach((editor) => {
                editor.setDecorations(translatedDecoration, []);
            });
            return;
        }

        if (!this._inplace) {
            let { append } = usePlaceholderCodeLensProvider();
            let lines = this._contentDecorations.map((decoration) => decoration.range.start.line);
            append(this._currDocument, lines);
        }
        targetEditors.forEach((editor) => {
            editor.setDecorations(translatedDecoration, this._contentDecorations);
        });
    }

    dispose() {
        this._desposed = true;
        this._loadingDecoration.dispose();
        this._translatedDecoration?.dispose();
    }
}

export class MarkdownDecoration extends CommentDecoration {
    constructor(block: ICommentBlock, currDocument: TextDocument, inplace: boolean = false) {
        super(block, currDocument, inplace);
    }

    private _getMarkdownPrefixLen(line: string): number {
        let remaining = line;
        let consumed = 0;

        const leadingSpace = remaining.match(/^\s{0,3}/);
        if (leadingSpace) {
            consumed += leadingSpace[0].length;
            remaining = remaining.slice(leadingSpace[0].length);
        }

        while (remaining.startsWith('>')) {
            const quote = remaining.match(/^>\s?/);
            if (!quote) {
                break;
            }
            consumed += quote[0].length;
            remaining = remaining.slice(quote[0].length);
        }

        const heading = remaining.match(/^#{1,6}\s+/);
        if (heading) {
            return consumed + heading[0].length;
        }

        const listTask = remaining.match(/^[-*+]\s+\[[ xX]\]\s+/);
        if (listTask) {
            return consumed + listTask[0].length;
        }

        const list = remaining.match(/^[-*+]\s+/);
        if (list) {
            return consumed + list[0].length;
        }

        const orderedList = remaining.match(/^\d+[.)]\s+/);
        if (orderedList) {
            return consumed + orderedList[0].length;
        }

        return consumed;
    }

    private _normalizeTargets(targetLines: string[], lineCount: number): string[] {
        if (targetLines.length === lineCount) {
            return targetLines;
        }
        if (targetLines.length === 1) {
            return [targetLines[0], ...new Array(lineCount - 1).fill('')];
        }
        const merged = targetLines.join(' ').trim();
        return [merged, ...new Array(lineCount - 1).fill('')];
    }

    protected async _compile(): Promise<ITranslatedText | null> {
        let result: ITranslatedText;

        let block = this._block;
        const lines = block.comment.split('\n');
        const tokens: ICommentToken[] = lines.map((line) => {
            const ignoreStart = this._getMarkdownPrefixLen(line);
            return {
                text: line,
                ignoreStart,
                ignoreEnd: 0,
            };
        });

        const texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
            return text.slice(ignoreStart, text.length - ignoreEnd).trim();
        });

        const sourceText = texts.join('\n');
        let translatedText = sourceText.length > 0
            ? await cachedTranslate(sourceText, { to: translateManager.opts.to || 'en' })
            : '';
        const targets = this._normalizeTargets(translatedText.split('\n'), lines.length);

        const reconstructedLines = tokens.map((token, index) => {
            const { text, ignoreStart = 0, ignoreEnd = 0 } = token;
            const startText = text.slice(0, ignoreStart);
            const endText = text.slice(text.length - ignoreEnd);
            const target = targets[index] || '';
            return startText + target + endText;
        });

        translatedText = reconstructedLines.join('\n');
        block.tokens = tokens;

        result = {
            translatedText,
            targets,
            texts,
            combined: [],
            translateLink: ''
        };

        return result;
    }
}
