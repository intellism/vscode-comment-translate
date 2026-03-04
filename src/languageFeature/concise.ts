import {
    window,
    TextEditorDecorationType,
    Disposable,
    workspace,
    Range,
    ExtensionContext
} from "vscode";
import { getConfig, onConfigChange } from "../configuration";
import { ICommentBlock } from "../interface";
import { debounce } from "../util/short-live";
import { createComment } from "../syntax/Comment";
import { compileBlock } from "../syntax/compile";
import { createHoverMarkdownString } from "./hoverUtil";
import { DecorationOptions } from "vscode";

class ConciseDecorationManager {
    private static instance: ConciseDecorationManager;
    private disposables: Disposable[] = [];
    private decorationType: TextEditorDecorationType | undefined;
    private canLanguages: string[] = [];
    private translationCache: Map<string, { translatedText: string, result: any }> = new Map();

    private constructor() {
    }

    public static getInstance(): ConciseDecorationManager {
        if (!ConciseDecorationManager.instance) {
            ConciseDecorationManager.instance = new ConciseDecorationManager();
        }
        return ConciseDecorationManager.instance;
    }

    public register(context: ExtensionContext, canLanguages: string[]) {
        this.canLanguages = canLanguages;
        this.decorationType = window.createTextEditorDecorationType({
            textDecoration: 'underline dashed',
        });
        window.onDidChangeTextEditorVisibleRanges(debounce(this.update.bind(this)), null, this.disposables);
        window.onDidChangeActiveTextEditor(debounce(this.update.bind(this)), null, this.disposables);

        onConfigChange('hover.concise', () => {
            this.update();
        }, null, this.disposables);

        workspace.onDidChangeTextDocument(debounce(() => this.update()), null, this.disposables);

        this.update();
        context.subscriptions.push(...this.disposables);
    }

    private async update() {
        const concise = getConfig<boolean>("hover.concise");
        const editor = window.activeTextEditor;

        if (!concise || !editor || !this.canLanguages.includes(editor.document.languageId)) {
            this.clear(editor);
            return;
        }

        const blocks = await this.getVisibleComments(editor);

        const decorationTasks = blocks.map(async block => {
            // Target the first 2 characters of the block for the underline
            const start = block.range.start;
            const end = block.range.start.translate(0, 2);
            const decorationRange = new Range(start, end);

            const uri = editor.document.uri.toString();
            const cacheKey = `${uri}-${block.range.start.line}-${block.range.start.character}-${block.comment}`;

            let hoverContent: { md: any, header: any };

            if (this.translationCache.has(cacheKey)) {
                const cached = this.translationCache.get(cacheKey)!;
                hoverContent = createHoverMarkdownString(
                    cached.translatedText,
                    cached.result.humanizeText,
                    uri,
                    block.range,
                    editor.document,
                    cached.result.translateLink
                );
            } else {
                const result = await compileBlock(block, editor.document.languageId);
                this.translationCache.set(cacheKey, { translatedText: result.translatedText, result });
                hoverContent = createHoverMarkdownString(
                    result.translatedText,
                    result.humanizeText,
                    uri,
                    block.range,
                    editor.document,
                    result.translateLink
                );
            }

            return {
                range: decorationRange,
                hoverMessage: [hoverContent.header, hoverContent.md]
            } as DecorationOptions;
        });

        const decorations = await Promise.all(decorationTasks);

        if (this.decorationType) {
            editor.setDecorations(this.decorationType, decorations);
        }
    }

    private clear(editor = window.activeTextEditor) {
        if (this.decorationType) {
            editor?.setDecorations(this.decorationType, []);
        }
    }

    private async getVisibleComments(editor = window.activeTextEditor): Promise<ICommentBlock[]> {
        if (!editor) return [];
        try {
            const comment = await createComment();
            // Using visibleRanges[0] as a simple heuristic, matching decoration.ts
            const blocks = await comment.getAllComment(
                editor.document,
                "comment",
                editor.visibleRanges[0]
            ) || [];

            const textBlocks = await comment.getAllComment(
                editor.document,
                "text",
                editor.visibleRanges[0]
            ) || [];

            return blocks?.concat(textBlocks);
        } catch (e) {
            return [];
        }
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.decorationType?.dispose();
    }
}

export const conciseDecorationManager = ConciseDecorationManager.getInstance();
