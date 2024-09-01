import { compileBlock } from "./compile";
import {
    window,
    Selection,
    DecorationOptions,
    TextEditorDecorationType,
    Disposable,
    TextDocument,
    workspace,
} from "vscode";
import { comment, ctx } from "../extension";
import { usePlaceholderCodeLensProvider } from "./codelen";
import { getConfig, onConfigChange } from "../configuration";
import { ICommentBlock } from "../interface";
import { debounce } from "../util/short-live";
import { getTextLength } from "../util/string";

class CommentDecorationManager {
    private static instance: CommentDecorationManager;
    private disposables: Disposable[] = [];
    private tempSet = new Set<string>();
    private inplace: boolean;
    private browseEnable: boolean;
    private hoverEnable: boolean;
    private blockMaps: Map<string, { comment: string, commentDecoration: CommentDecoration }> = new Map();
    private currDocument: TextDocument | undefined;
    private canLanguages: string[] = [];
    private BlackLanguage: string[] = ['markdown'];

    private constructor() {
        this.inplace = getConfig<string>('browse.mode', 'contrast') === 'inplace';
        this.browseEnable = getConfig<boolean>('browse.enabled', true);
        this.hoverEnable = getConfig<boolean>('hover.enabled', true);
    }

    public static getInstance(): CommentDecorationManager {
        if (!CommentDecorationManager.instance) {
            CommentDecorationManager.instance = new CommentDecorationManager();
        }
        return CommentDecorationManager.instance;
    }

    public toggleBrowseCommentTranslate() {
        let uriStr = window.activeTextEditor?.document.uri.toString();
        if (!uriStr) return;
        if (this.tempSet.has(uriStr)) {
            this.tempSet.delete(uriStr);
        } else {
            this.tempSet.add(uriStr);
        }
        this.resetCommentDecoration();
    }

    private shouldShowBrowser() {
        let uri = window.activeTextEditor?.document.uri.toString();
        let docTemporarilyToggled = uri && this.tempSet.has(uri);
        let docBrowseEnabled = docTemporarilyToggled ? !this.browseEnable : this.browseEnable;
        let ultimatelyBrowseEnable = docBrowseEnabled && this.hoverEnable;

        return ultimatelyBrowseEnable;
    }

    public showBrowseCommentTranslate(languages: string[]) {
        this.canLanguages = languages.filter((v) => this.BlackLanguage.indexOf(v) < 0);
        window.onDidChangeTextEditorVisibleRanges(debounce(this.showBrowseCommentTranslateImpl.bind(this)), null, this.disposables);
        window.onDidChangeTextEditorSelection(debounce(this.updateCommentDecoration.bind(this)), null, this.disposables);
        window.onDidChangeActiveTextEditor(debounce(this.resetCommentDecoration.bind(this)), null, this.disposables);
        workspace.onDidCloseTextDocument((doc) => {
            let uriStr = doc.uri.toString();
            if (this.tempSet.has(uriStr)) {
                this.tempSet.delete(uriStr);
            }
        });

        onConfigChange('browse.mode', (value: string) => {
            this.inplace = value === 'inplace';
            this.resetCommentDecoration();
        }, null, this.disposables);

        onConfigChange('browse.enabled', (value: boolean) => {
            this.browseEnable = value;
            this.resetCommentDecoration();
        }, null, this.disposables);

        onConfigChange('hover.enabled', (value: boolean) => {
            this.hoverEnable = value;
            this.resetCommentDecoration();
        }, null, this.disposables);

        let timer: any;
        workspace.onDidChangeTextDocument(
            (e) => {
                if (e.document === this.currDocument) {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        this.showBrowseCommentTranslateImpl(false);
                    }, 300);
                }
            },
            null,
            this.disposables,
        );

        this.showBrowseCommentTranslateImpl();

        return this.disposables;
    }

    private async showBrowseCommentTranslateImpl(maintain = true) {
        if (!this.shouldShowBrowser()) return;

        let editor = window.activeTextEditor;
        this.currDocument = editor?.document;

        if (!editor || !editor.document || !this.currDocument) {
            return;
        }

        if (!this.canLanguages.includes(this.currDocument.languageId)) {
            return;
        }

        let blocks: ICommentBlock[] | null = null;

        try {
            blocks = await comment.getAllComment(
                this.currDocument,
                "comment",
                editor.visibleRanges[0]
            );
        } catch (error) {
            console.error(error);
        }
        if (!blocks || blocks.length === 0) return;

        let newBlockMaps: Map<string, { comment: string, commentDecoration: CommentDecoration }> = new Map();
        blocks.forEach((block) => {
            let { start, end } = block.range;
            let uriStr = this.currDocument!.uri.toString() || '';
            let key = `${uriStr}~${start.line}:${start.character}-${end.line}:${end.character}`;
            if (this.blockMaps.has(key)) {
                let value = this.blockMaps.get(key)!;
                if (value.comment === block.comment) {
                    newBlockMaps.set(key, value);
                    return;
                }
                value.commentDecoration.dispose();
                this.blockMaps.delete(key);
            }
            let commentDecoration = new CommentDecoration(block, this.currDocument!, this.inplace);
            newBlockMaps.set(key, { comment: block.comment, commentDecoration });
            return commentDecoration;
        });

        if (maintain) {
            newBlockMaps.forEach((value, key) => {
                this.blockMaps.set(key, value);
            });
        } else {
            this.blockMaps.forEach((value, key) => {
                if (!newBlockMaps.has(key)) {
                    value.commentDecoration.dispose();
                }
            });
            this.blockMaps = newBlockMaps;
        }
    }

    private updateCommentDecoration() {
        this.blockMaps.forEach((value) => {
            value.commentDecoration.reflash();
        });
    }

    private resetCommentDecoration() {
        this.blockMaps.forEach((value) => {
            value.commentDecoration.dispose();
        });
        this.blockMaps.clear();
        let { cleanAll } = usePlaceholderCodeLensProvider();
        cleanAll();
        this.currDocument = undefined;
        this.showBrowseCommentTranslateImpl();
    }
}

class CommentDecoration {
    private _loading: boolean = true;
    private _desposed: boolean = false;
    private _loadingDecoration: TextEditorDecorationType;
    private _translatedDecoration: TextEditorDecorationType | undefined;
    private _contentDecorations: DecorationOptions[] = [];

    constructor(private _block: ICommentBlock, private _currDocument: TextDocument, private _inplace: boolean = false) {
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

    editing() {
        let range = this._block.range;
        let selection = window.activeTextEditor?.selection;
        if (selection) {
            return range.contains(selection);
        }
        return false;
    }

    // Translate commentblock text and set decorative content
    async translate() {
        let { tokens, range } = this._block;
        if (!tokens || tokens.length === 0) return;

        let result = await compileBlock(this._block, this._currDocument.languageId);
        this._loading = false;
        let { targets, texts, combined } = result;

        let targetIndex = 0;
        let tokensLength = tokens.length || 0;
        tokens.forEach((token, i) => {
            let { text, ignoreStart = 0, ignoreEnd = 0 } = token;
            const translateText = texts[i];
            let targetText = translateText.length > 0 ? targets[targetIndex++] : "";
            let offset = i === 0 ? range.start.character : 0;
            let originText = text.slice(ignoreStart, text.length - ignoreEnd);

            let combinedIndex = i;

            if (this._inplace) {
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
                let showLineLen = getTextLength(this._currDocument!.lineAt(range.start.line + combinedIndex + 1).text);
                // let offsetText = texts[combinedIndex].substring(0, offset + ignoreStart);
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
                    // textDecoration: text.trim().length > 0 ? `none;word-wrap: break-word; white-space: pre-wrap;display: inline-block; width:calc(${showLineLen}ch); max-height: ${lines}lh; position: relative;` : '',
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
        }
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
        if (this._loading) {
            window.activeTextEditor?.setDecorations(this._loadingDecoration, [
                this._block.range,
            ]);
            return;
        } else {
            window.activeTextEditor?.setDecorations(this._loadingDecoration, []);
        }

        // The current comment block is being edited, translation status is not displayed
        if (this._inplace && this.editing() && this._translatedDecoration) {
            window.activeTextEditor?.setDecorations(this._translatedDecoration, []);
            return;
        }

        if (!this._inplace) {
            let { append } = usePlaceholderCodeLensProvider();
            let lines = this._contentDecorations.map((decoration) => decoration.range.start.line);
            append(window.activeTextEditor?.document!, lines);
        }

        if (this._contentDecorations.length) {
            let translatedDecoration = this.getTranslatedDecoration();
            window.activeTextEditor?.setDecorations(translatedDecoration, this._contentDecorations);
        }
    }

    dispose() {
        this._desposed = true;
        this._loadingDecoration.dispose();
        this._translatedDecoration?.dispose();
    }
}

export const commentDecorationManager = CommentDecorationManager.getInstance();
