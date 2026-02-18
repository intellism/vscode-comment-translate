import { compileBlock } from "../syntax/compile";
import {
    window,
    Selection,
    DecorationOptions,
    TextEditorDecorationType,
    Disposable,
    TextDocument,
    workspace,
    Range,
    commands,
} from "vscode";
import { ctx } from "../extension";
import { usePlaceholderCodeLensProvider } from "./codelen";
import { getConfig, onConfigChange } from "../configuration";
import { checkScopeFunction, ICommentBlock, ICommentToken, ITranslatedText } from "../interface";
import { debounce } from "../util/short-live";
import { getTextLength } from "../util/string";
import { cachedTranslate, translateManager } from "../translate/manager";
import { createComment } from "../syntax/Comment";

interface IFenceState {
    marker: '`' | '~';
    len: number;
}
// helper interface for markdown code fence scanning result
interface IMarkdownFenceScanResult {
    occupiedLines: Set<number>;
    inFenceAtRangeStart: boolean;
}

class CommentDecorationManager {
    private static instance: CommentDecorationManager;
    private disposables: Disposable[] = [];
    private tempSet = new Set<string>();
    private inplace: boolean;
    private browseEnable: boolean;
    private blockMaps: Map<string, { comment: string, commentDecoration: CommentDecoration }> = new Map();
    private currDocument: TextDocument | undefined;
    private canLanguages: string[] = [];
    private BlackLanguage: string[] = [];
    private browseTimer: ReturnType<typeof setTimeout> | undefined;
    private browseRequestSeq = 0;
    private avgRenderCost = 0;
    private lastSelection: Selection | undefined;
    private markdownScopeFallbackDisabled = false;

    private constructor() {
        this.inplace = getConfig<string>('browse.mode', 'contrast') === 'inplace';
        this.browseEnable = getConfig<boolean>('browse.enabled', true);
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
        let ultimatelyBrowseEnable = docBrowseEnabled;
        commands.executeCommand('setContext', 'commentTranslate.ultimatelyBrowseEnable', ultimatelyBrowseEnable);
        return ultimatelyBrowseEnable;
    }

    public showBrowseCommentTranslate(languages: string[]) {
        this.canLanguages = languages.filter((v) => this.BlackLanguage.indexOf(v) < 0);
        window.onDidChangeTextEditorVisibleRanges(() => {
            this.scheduleBrowseRefresh('scroll', true);
        }, null, this.disposables);
        window.onDidChangeTextEditorSelection(debounce(this.updateCommentDecoration.bind(this)), null, this.disposables);
        window.onDidChangeActiveTextEditor(() => {
            this.resetCommentDecoration();
        }, null, this.disposables);
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
            this.tempSet.clear();
            this.resetCommentDecoration();
        }, null, this.disposables);

        workspace.onDidChangeTextDocument(
            (e) => {
                if (e.document === this.currDocument) {
                    this.scheduleBrowseRefresh('edit', false);
                }
            },
            null,
            this.disposables,
        );

        this.showBrowseCommentTranslateImpl();

        return this.disposables;
    }

    private scheduleBrowseRefresh(reason: 'scroll' | 'edit' | 'active', maintain: boolean) {
        if (this.browseTimer) {
            clearTimeout(this.browseTimer);
        }

        let delay = reason === 'edit' ? 110 : 70;
        if (this.avgRenderCost > 700) {
            delay += 80;
        }
        if (this.avgRenderCost > 1300) {
            delay += 120;
        }

        this.browseTimer = setTimeout(() => {
            this.showBrowseCommentTranslateImpl(maintain);
        }, delay);
    }

    private _parseFence(trimText: string): IFenceState | null {
        const match = trimText.match(/^([`~]{3,})/);
        if (!match || !match[1]) {
            return null;
        }

        const markerText = match[1];
        const marker = markerText[0];
        if ((marker !== '`' && marker !== '~') || markerText.split('').some((item) => item !== marker)) {
            return null;
        }

        return {
            marker,
            len: markerText.length
        };
    }

    private _isFenceClose(trimText: string, fence: IFenceState): boolean {
        const close = trimText.match(/^([`~]{3,})\s*$/);
        if (!close || !close[1]) {
            return false;
        }

        const markerText = close[1];
        return markerText[0] === fence.marker && markerText.length >= fence.len;
    }

    private _getFenceStateBeforeLine(document: TextDocument, endLineExclusive: number): IFenceState | null {
        let fence: IFenceState | null = null;

        for (let line = 0; line < endLineExclusive; line++) {
            const text = document.lineAt(line).text.trimStart();
            if (!fence) {
                const openFence = this._parseFence(text);
                if (openFence) {
                    fence = openFence;
                }
                continue;
            }

            if (this._isFenceClose(text, fence)) {
                fence = null;
            }
        }

        return fence;
    }

    private _isMarkdownCodeScope: checkScopeFunction = (scopes) => {
        const rules = [
            /^meta\.embedded\.block\.shellscript/,
            /^variable\.other\.rust/,
            /^meta\.embedded\.block\.rust/,
            /^markup\.fenced_code\.block\.markdown/,
            /^meta\.embedded\.block\./
        ];

        return scopes.some((scope) => rules.some((rule) => rule.test(scope)));
    };

    private _getExpandedVisibleRange(document: TextDocument, visibleRange: Range, paddingLines: number = 120) {
        const startLine = Math.max(0, visibleRange.start.line - paddingLines);
        const endLine = Math.min(document.lineCount - 1, visibleRange.end.line + paddingLines);
        const endLineText = document.lineAt(endLine).text;
        return new Range(startLine, 0, endLine, endLineText.length);
    }

    private _scanMarkdownFenceLines(document: TextDocument, visibleRange: Range): IMarkdownFenceScanResult {
        let fence = this._getFenceStateBeforeLine(document, visibleRange.start.line);
        const occupiedLines = new Set<number>();
        const inFenceAtRangeStart = !!fence;

        for (let line = visibleRange.start.line; line <= visibleRange.end.line; line++) {
            const text = document.lineAt(line).text;
            const trimText = text.trimStart();

            if (!fence) {
                const openFence = this._parseFence(trimText);
                if (openFence) {
                    occupiedLines.add(line);
                    fence = openFence;
                    continue;
                }
            } else {
                occupiedLines.add(line);
                if (this._isFenceClose(trimText, fence)) {
                    fence = null;
                }
            }
        }

        return {
            occupiedLines,
            inFenceAtRangeStart
        };
    }

    private _getMarkdownTextBlocks(document: TextDocument, visibleRange: Range, occupiedLineSet: Set<number>, inFenceAtRangeStart: boolean): ICommentBlock[] {
        const blocks: ICommentBlock[] = [];
        let paragraphStart = -1;
        let paragraphTexts: string[] = [];

        const pushParagraph = () => {
            if (paragraphStart < 0 || paragraphTexts.length === 0) {
                paragraphStart = -1;
                paragraphTexts = [];
                return;
            }

            const endLine = paragraphStart + paragraphTexts.length - 1;
            const endLineText = document.lineAt(endLine).text;
            blocks.push({
                range: new Range(paragraphStart, 0, endLine, endLineText.length),
                comment: paragraphTexts.join('\n')
            });

            paragraphStart = -1;
            paragraphTexts = [];
        };

        let fence = inFenceAtRangeStart ? this._getFenceStateBeforeLine(document, visibleRange.start.line) : null;
        for (let line = visibleRange.start.line; line <= visibleRange.end.line; line++) {
            const text = document.lineAt(line).text;
            const trimText = text.trimStart();

            if (!fence) {
                const openFence = this._parseFence(trimText);
                if (openFence) {
                    pushParagraph();
                    fence = openFence;
                    continue;
                }
            } else if (this._isFenceClose(trimText, fence)) {
                pushParagraph();
                fence = null;
                continue;
            }

            if (fence || occupiedLineSet.has(line)) {
                pushParagraph();
                continue;
            }

            if (trimText.trim().length === 0) {
                pushParagraph();
                continue;
            }

            if (this._isMarkdownStructureBoundary(trimText)) {
                pushParagraph();
                continue;
            }

            if (paragraphStart < 0) {
                paragraphStart = line;
            }
            paragraphTexts.push(text);
        }

        pushParagraph();

        return blocks;
    }

    private _isMarkdownStructureBoundary(trimText: string): boolean {
        if (/^(?:[-*_]\s*){3,}$/.test(trimText)) {
            return true;
        }

        const tableSeparator = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/;
        return tableSeparator.test(trimText);
    }

    private updateAvgRenderCost(cost: number) {
        if (cost <= 0) {
            return;
        }
        if (this.avgRenderCost === 0) {
            this.avgRenderCost = cost;
            return;
        }
        this.avgRenderCost = this.avgRenderCost * 0.75 + cost * 0.25;
    }

    private async showBrowseCommentTranslateImpl(maintain = true) {
        const startAt = Date.now();
        if (!this.shouldShowBrowser()) return;

        let editor = window.activeTextEditor;
        this.currDocument = editor?.document;

        if (!editor || !editor.document || !this.currDocument) {
            return;
        }

        if (!this.canLanguages.includes(this.currDocument.languageId)) {
            return;
        }

        const renderSeq = ++this.browseRequestSeq;

        let blocks: ICommentBlock[] | null = null;

        try {
            const visibleRange = editor.visibleRanges[0];
            if (this.currDocument.languageId === 'markdown') {
                const parseRange = this._getExpandedVisibleRange(this.currDocument, visibleRange);
                const occupiedLineSet = new Set<number>();
                const fenceScan = this._scanMarkdownFenceLines(this.currDocument, parseRange);
                fenceScan.occupiedLines.forEach((line) => occupiedLineSet.add(line));

                const scopeFallback = getConfig<boolean>('markdown.scopeFallback', true);
                if (scopeFallback && !this.markdownScopeFallbackDisabled) {
                    try {
                        const comment = await createComment();
                        const codeBlocks = await comment.getAllScopeBlocks(
                            this.currDocument,
                            this._isMarkdownCodeScope,
                            parseRange
                        ) || [];
                        codeBlocks.forEach((block) => {
                            for (let line = block.range.start.line; line <= block.range.end.line; line++) {
                                occupiedLineSet.add(line);
                            }
                        });
                    } catch (error) {
                        const err = error as Error;
                        if (err && typeof err.message === 'string' && /look.?behind/i.test(err.message)) {
                            this.markdownScopeFallbackDisabled = true;
                            console.warn('[comment-translate] markdown.scopeFallback disabled for current session due to invalid grammar regex.', error);
                        } else {
                            console.warn('[comment-translate] markdown.scopeFallback encountered unexpected error; leaving fallback enabled.', error);
                        }
                    }
                }

                blocks = this._getMarkdownTextBlocks(
                    this.currDocument,
                    parseRange,
                    occupiedLineSet,
                    fenceScan.inFenceAtRangeStart
                );

                blocks = blocks.filter((block) => !!block.range.intersection(visibleRange));
            } else {
                let comment = await createComment();
                blocks = await comment.getAllComment(
                    this.currDocument,
                    "comment",
                    visibleRange
                );
            }
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
            let commentDecoration: CommentDecoration;

            if (this.currDocument!.languageId === 'markdown' && (!block.tokens || block.tokens.length === 0)) {
                commentDecoration = new MarkdownDecoration(block, this.currDocument!, this.inplace);
            } else {
                commentDecoration = new CommentDecoration(block, this.currDocument!, this.inplace)
            }

            newBlockMaps.set(key, { comment: block.comment, commentDecoration });
            return commentDecoration;
        });

        if (renderSeq !== this.browseRequestSeq || this.currDocument !== editor.document) {
            newBlockMaps.forEach((value) => {
                value.commentDecoration.dispose();
            });
            this.updateAvgRenderCost(Date.now() - startAt);
            return;
        }

        if (maintain && editor.visibleRanges.length > 0) {
            const primaryVisibleRange = editor.visibleRanges[0];
            const bufferLines = 200;
            const document = editor.document;
            const startLine = Math.max(0, primaryVisibleRange.start.line - bufferLines);
            const endLine = Math.min(document.lineCount - 1, primaryVisibleRange.end.line + bufferLines);
            const endChar = document.lineAt(endLine).range.end.character;
            const extendedVisibleRange = new Range(startLine, 0, endLine, endChar);

            this.blockMaps.forEach((value, key) => {
                if (newBlockMaps.has(key)) {
                    return;
                }

                // Dispose entries that are completely outside the buffered visible range.
                if (!value.commentDecoration.block.range.intersection(extendedVisibleRange)) {
                    value.commentDecoration.dispose();
                    this.blockMaps.delete(key);
                }
            });

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

        this.updateAvgRenderCost(Date.now() - startAt);
    }

    private updateCommentDecoration() {
        const editor = window.activeTextEditor;
        const currentSelection = editor?.selection;
        const previousSelection = this.lastSelection;
        this.lastSelection = currentSelection;

        if (!currentSelection) {
            return;
        }

        this.blockMaps.forEach((value) => {
            if (!this.inplace) {
                value.commentDecoration.reflash();
                return;
            }

            const range = value.commentDecoration.block.range;
            const hitCurrent = !!range.intersection(currentSelection);
            const hitPrevious = previousSelection ? !!range.intersection(previousSelection) : false;
            if (hitCurrent || hitPrevious) {
                value.commentDecoration.reflash();
            }
        });
    }

    private resetCommentDecoration() {
        if (this.browseTimer) {
            clearTimeout(this.browseTimer);
            this.browseTimer = undefined;
        }
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

    protected async _compile(): Promise<ITranslatedText | null> {
        let { tokens } = this._block;
        if (!tokens || tokens.length === 0) return null;
        return compileBlock(this._block, this._currDocument.languageId);
    }

    // Translate commentblock text and set decorative content
    async translate() {
        let result = await this._compile();
        let { tokens, range } = this._block;
        if (!result) return;
        if (!tokens || tokens.length === 0) return null;

        this._loading = false;
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

        let translatedDecoration = this.getTranslatedDecoration();
        // The current comment block is being edited, translation status is not displayed
        if (this._inplace && this.editing()) {
            window.activeTextEditor?.setDecorations(translatedDecoration, []);
            return;
        }

        if (!this._inplace) {
            let { append } = usePlaceholderCodeLensProvider();
            let lines = this._contentDecorations.map((decoration) => decoration.range.start.line);
            append(window.activeTextEditor?.document!, lines);
        }
        window.activeTextEditor?.setDecorations(translatedDecoration, this._contentDecorations);
    }

    dispose() {
        this._desposed = true;
        this._loadingDecoration.dispose();
        this._translatedDecoration?.dispose();
    }
}


class MarkdownDecoration extends CommentDecoration {
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
        }

        return result;
    }
}

export const commentDecorationManager = CommentDecorationManager.getInstance();
