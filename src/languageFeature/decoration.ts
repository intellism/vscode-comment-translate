import {
    window,
    Selection,
    Disposable,
    TextDocument,
    workspace,
    Range,
    commands,
} from "vscode";
import { usePlaceholderCodeLensProvider } from "./codelen";
import { getConfig, onConfigChange } from "../configuration";
import { ICommentBlock } from "../interface";
import { debounce } from "../util/short-live";
import { createComment } from "../syntax/Comment";
import {
    getExpandedVisibleRange,
    scanMarkdownFenceLines,
    getMarkdownTextBlocks,
    isRstStructureBoundary,
    getParagraphTextBlocks,
    isMarkdownCodeScope,
} from "./blockParser";
import { CommentDecoration, MarkdownDecoration } from "./commentDecoration";

class CommentDecorationManager {
    private static readonly HIDDEN_DOC_CACHE_LIMIT = 2;
    private static readonly BROWSE_FALLBACK_LANGUAGES = new Set<string>([
        'plaintext',
        'text',
    ]);
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
    private documentAccessAt = new Map<string, number>();

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
        this.touchDocument(uriStr);
        this.resetCommentDecoration();
    }

    private touchDocument(uriStr: string) {
        this.documentAccessAt.set(uriStr, Date.now());
    }

    private getVisibleDocumentUris(): Set<string> {
        const uris = new Set<string>();
        window.visibleTextEditors.forEach((editor) => {
            uris.add(editor.document.uri.toString());
        });
        return uris;
    }

    private disposeBlocksByUri(uriStr: string) {
        const prefix = `${uriStr}~`;
        this.blockMaps.forEach((value, key) => {
            if (!key.startsWith(prefix)) {
                return;
            }
            value.commentDecoration.dispose();
            this.blockMaps.delete(key);
        });
    }

    private pruneHiddenDocumentCaches(currentUriStr?: string) {
        const visibleUris = this.getVisibleDocumentUris();
        if (currentUriStr) {
            visibleUris.add(currentUriStr);
        }

        const hiddenCandidates = Array.from(this.documentAccessAt.entries())
            .filter(([uri]) => !visibleUris.has(uri))
            .sort((a, b) => b[1] - a[1]);

        const retainedHidden = hiddenCandidates.slice(0, CommentDecorationManager.HIDDEN_DOC_CACHE_LIMIT);
        const retainedUris = new Set(retainedHidden.map(([uri]) => uri));

        hiddenCandidates.slice(CommentDecorationManager.HIDDEN_DOC_CACHE_LIMIT).forEach(([uri]) => {
            this.disposeBlocksByUri(uri);
            this.documentAccessAt.delete(uri);
        });

        this.blockMaps.forEach((value, key) => {
            const uri = key.split('~')[0];
            if (visibleUris.has(uri) || retainedUris.has(uri)) {
                return;
            }
            value.commentDecoration.dispose();
            this.blockMaps.delete(key);
        });
    }

    private shouldShowBrowser() {
        let uri = window.activeTextEditor?.document.uri.toString();
        let docTemporarilyToggled = uri && this.tempSet.has(uri);
        let docBrowseEnabled = docTemporarilyToggled ? !this.browseEnable : this.browseEnable;
        let ultimatelyBrowseEnable = docBrowseEnabled;
        commands.executeCommand('setContext', 'commentTranslate.ultimatelyBrowseEnable', ultimatelyBrowseEnable);
        return ultimatelyBrowseEnable;
    }

    private canBrowseLanguage(languageId: string): boolean {
        return this.canLanguages.includes(languageId)
            || CommentDecorationManager.BROWSE_FALLBACK_LANGUAGES.has(languageId);
    }

    public showBrowseCommentTranslate(languages: string[]) {
        this.canLanguages = languages.filter((v) => this.BlackLanguage.indexOf(v) < 0);
        window.onDidChangeTextEditorVisibleRanges(() => {
            this.scheduleBrowseRefresh('scroll', true);
        }, null, this.disposables);
        window.onDidChangeTextEditorSelection(debounce(this.updateCommentDecoration.bind(this)), null, this.disposables);
        window.onDidChangeActiveTextEditor(() => {
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }

            const uriStr = editor.document.uri.toString();
            this.touchDocument(uriStr);

            if (!this.canBrowseLanguage(editor.document.languageId)) {
                this.pruneHiddenDocumentCaches();
                return;
            }

            if (this.currDocument && editor.document === this.currDocument) {
                this.updateCommentDecoration();
                this.pruneHiddenDocumentCaches(uriStr);
                return;
            }

            this.scheduleBrowseRefresh('active', true);
        }, null, this.disposables);
        workspace.onDidCloseTextDocument((doc) => {
            let uriStr = doc.uri.toString();
            if (this.tempSet.has(uriStr)) {
                this.tempSet.delete(uriStr);
            }
            this.disposeBlocksByUri(uriStr);
            this.documentAccessAt.delete(uriStr);
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

        if (!this.canBrowseLanguage(this.currDocument.languageId)) {
            return;
        }

        const currentUriStr = this.currDocument.uri.toString();
        this.touchDocument(currentUriStr);

        const renderSeq = ++this.browseRequestSeq;

        let blocks: ICommentBlock[] | null = null;

        try {
            const visibleRange = editor.visibleRanges[0];
            if (this.currDocument.languageId === 'markdown') {
                const parseRange = getExpandedVisibleRange(this.currDocument, visibleRange);
                const occupiedLineSet = new Set<number>();
                const fenceScan = scanMarkdownFenceLines(this.currDocument, parseRange);
                fenceScan.occupiedLines.forEach((line) => occupiedLineSet.add(line));

                const scopeFallback = getConfig<boolean>('markdown.scopeFallback', true);
                if (scopeFallback && !this.markdownScopeFallbackDisabled) {
                    try {
                        const comment = await createComment();
                        const codeBlocks = await comment.getAllScopeBlocks(
                            this.currDocument,
                            isMarkdownCodeScope,
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

                blocks = getMarkdownTextBlocks(
                    this.currDocument,
                    parseRange,
                    occupiedLineSet,
                    fenceScan.inFenceAtRangeStart
                );

                blocks = blocks.filter((block) => !!block.range.intersection(visibleRange));
            } else if (this.currDocument.languageId === 'restructuredtext' || this.currDocument.languageId === 'rst') {
                const parseRange = getExpandedVisibleRange(this.currDocument, visibleRange);
                blocks = getParagraphTextBlocks(this.currDocument, parseRange, {
                    isBoundary: isRstStructureBoundary
                }).filter((block) => !!block.range.intersection(visibleRange));
            } else if (this.currDocument.languageId === 'plaintext' || this.currDocument.languageId === 'text') {
                const parseRange = getExpandedVisibleRange(this.currDocument, visibleRange);
                blocks = getParagraphTextBlocks(this.currDocument, parseRange)
                    .filter((block) => !!block.range.intersection(visibleRange));
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
                commentDecoration = new CommentDecoration(block, this.currDocument!, this.inplace);
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
                if (!key.startsWith(`${currentUriStr}~`)) {
                    return;
                }

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
                if (!key.startsWith(`${currentUriStr}~`)) {
                    return;
                }

                if (!newBlockMaps.has(key)) {
                    value.commentDecoration.dispose();
                    this.blockMaps.delete(key);
                }
            });

            newBlockMaps.forEach((value, key) => {
                this.blockMaps.set(key, value);
            });
        }

        this.pruneHiddenDocumentCaches(currentUriStr);

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

export const commentDecorationManager = CommentDecorationManager.getInstance();
