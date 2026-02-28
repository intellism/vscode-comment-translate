import {
    commands,
    EventEmitter,
    ExtensionContext,
    TextDocumentContentProvider,
    Uri,
    window,
    workspace,
} from "vscode";
import { buildLoadingSnapshot, translateMarkdownDocumentProgressive } from "../syntax/markdownDocument";
import { cachedTranslate } from "../translate/manager";

/** Custom URI scheme for translated markdown virtual documents */
export const TRANSLATED_MARKDOWN_SCHEME = "translated-markdown";

/** Number of translatable entries to translate per batch */
const TRANSLATION_BATCH_SIZE = 5;

/**
 * Provides translated markdown content as a virtual document.
 *
 * Translation happens progressively in batches. While translation is in
 * progress, untranslated lines show the original source text with a loading
 * indicator. Each completed batch triggers a content-change event so the
 * preview updates incrementally.
 */
class TranslatedMarkdownProvider implements TextDocumentContentProvider {
    private onDidChangeEmitter = new EventEmitter<Uri>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    /** Current document snapshot per URI (updated progressively during translation) */
    private contentCache = new Map<string, string>();

    /** Active translation generation per URI (used to cancel stale translations) */
    private activeTranslations = new Map<string, number>();

    /**
     * Fire a change event so VS Code re-fetches the translated content.
     * Called when the source document changes or the translation config changes.
     */
    fireChange(uri: Uri): void {
        this.onDidChangeEmitter.fire(uri);
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        const uriKey = uri.toString();

        // If we already have a cached snapshot (from an in-progress or completed
        // translation), return it immediately.
        const cached = this.contentCache.get(uriKey);
        if (cached !== undefined) {
            return cached;
        }

        // No cache – read the source and build an initial loading snapshot
        // immediately so the preview panel is never blank.
        const sourceUri = toSourceUri(uri);
        const sourceDocument = await workspace.openTextDocument(sourceUri);
        const sourceText = sourceDocument.getText();

        if (!sourceText.trim()) {
            return sourceText;
        }

        // Build initial snapshot: all translatable lines show source text + loading icon
        const initialSnapshot = buildLoadingSnapshot(sourceText);
        this.contentCache.set(uriKey, initialSnapshot);

        // Start progressive translation in the background (fire-and-forget).
        // Each batch completion updates the cache and fires a change event,
        // causing VS Code to call provideTextDocumentContent again, which
        // then returns the latest cached snapshot.
        this.startProgressiveTranslation(uri, sourceText);

        return initialSnapshot;
    }

    /**
     * Start a progressive translation in the background.
     * Updates contentCache and fires change events as batches complete.
     */
    private startProgressiveTranslation(uri: Uri, sourceText: string): void {
        const uriKey = uri.toString();

        // Assign a unique generation id so we can detect stale translations
        const generationId = Date.now();
        this.activeTranslations.set(uriKey, generationId);

        translateMarkdownDocumentProgressive(
            sourceText,
            (text) => cachedTranslate(text),
            (snapshot) => {
                // Ignore progress from a stale translation
                if (this.activeTranslations.get(uriKey) !== generationId) {
                    return;
                }
                this.contentCache.set(uriKey, snapshot);
                this.onDidChangeEmitter.fire(uri);
            },
            TRANSLATION_BATCH_SIZE,
        ).then((translated) => {
            // Only update if this is still the active translation
            if (this.activeTranslations.get(uriKey) === generationId) {
                this.contentCache.set(uriKey, translated);
                this.onDidChangeEmitter.fire(uri);
            }
        }).catch((error) => {
            if (this.activeTranslations.get(uriKey) === generationId) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const fallback = `<!-- Translation error: ${errorMessage} -->\n${sourceText}`;
                this.contentCache.set(uriKey, fallback);
                this.onDidChangeEmitter.fire(uri);
            }
        });
    }

    /**
     * Invalidate the cache for a URI so the next provideTextDocumentContent
     * call triggers a fresh progressive translation.
     */
    invalidate(uri: Uri): void {
        const uriKey = uri.toString();
        this.contentCache.delete(uriKey);
        // Bump generation to cancel any in-flight translation
        this.activeTranslations.set(uriKey, Date.now());
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
        this.contentCache.clear();
        this.activeTranslations.clear();
    }
}

/**
 * Convert a source file URI to the translated-markdown virtual document URI.
 * The original URI is encoded into the path and query.
 */
export function toTranslatedUri(sourceUri: Uri): Uri {
    return Uri.parse(
        `${TRANSLATED_MARKDOWN_SCHEME}://preview${sourceUri.path}?${encodeURIComponent(sourceUri.toString())}`
    );
}

/**
 * Convert a translated-markdown virtual document URI back to the source file URI.
 */
function toSourceUri(translatedUri: Uri): Uri {
    const sourceUriString = decodeURIComponent(translatedUri.query);
    return Uri.parse(sourceUriString);
}

/**
 * Open the translated markdown preview for the currently active markdown file.
 * Uses VS Code's built-in markdown preview to render the translated virtual document.
 *
 * The built-in `markdown.showPreviewToSide` follows the *active editor* and
 * reuses an existing preview panel, ignoring the URI argument. To work around
 * this we use `markdown.showPreview` which respects the URI argument and opens
 * a dedicated preview tab for the given URI.
 *
 * If a side preview already exists showing the source file, we first close it
 * by focusing the side column and closing the active editor there, then open
 * the translated preview fresh.
 */
async function openTranslatedMarkdownPreview(): Promise<void> {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
        window.showWarningMessage("No active markdown file to preview.");
        return;
    }

    const sourceUri = activeEditor.document.uri;
    if (activeEditor.document.languageId !== "markdown") {
        window.showWarningMessage("The active file is not a markdown document.");
        return;
    }

    const translatedUri = toTranslatedUri(sourceUri);

    // Ensure the virtual document is loaded so the markdown preview can
    // read its content. This does NOT open a visible editor tab.
    await workspace.openTextDocument(translatedUri);

    // Use markdown.showPreview (not showPreviewToSide) with the translated
    // URI. This command respects the URI argument and creates a dedicated
    // preview tab for it, independent of the active editor.
    await commands.executeCommand("markdown.showPreview", translatedUri);
}

/**
 * Register the translated markdown preview feature:
 * - TextDocumentContentProvider for the `translated-markdown` scheme
 * - Command to open the translated preview
 * - Auto-refresh when the source document changes
 */
export function registerMarkdownPreview(context: ExtensionContext): void {
    const provider = new TranslatedMarkdownProvider();

    context.subscriptions.push(
        workspace.registerTextDocumentContentProvider(TRANSLATED_MARKDOWN_SCHEME, provider),
        commands.registerCommand(
            "commentTranslate.openMarkdownTranslatePreview",
            openTranslatedMarkdownPreview
        ),
    );

    // Re-translate when the source markdown document changes
    context.subscriptions.push(
        workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === "markdown" && event.document.uri.scheme === "file") {
                const translatedUri = toTranslatedUri(event.document.uri);
                provider.invalidate(translatedUri);
                provider.fireChange(translatedUri);
            }
        })
    );

    // Re-translate when translation configuration changes
    context.subscriptions.push(
        workspace.onDidChangeConfiguration((event) => {
            if (
                event.affectsConfiguration("commentTranslate.targetLanguage") ||
                event.affectsConfiguration("commentTranslate.source")
            ) {
                // Invalidate and refresh all open translated markdown documents
                for (const doc of workspace.textDocuments) {
                    if (doc.uri.scheme === TRANSLATED_MARKDOWN_SCHEME) {
                        provider.invalidate(doc.uri);
                        provider.fireChange(doc.uri);
                    }
                }
            }
        })
    );
}
