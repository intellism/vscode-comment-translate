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

/** Debounce delay (ms) before re-translating after a source document change */
const CHANGE_DEBOUNCE_MS = 500;

/**
 * Provides translated markdown content as a virtual document.
 *
 * Translation happens progressively in batches. While translation is in
 * progress, untranslated lines show the original source text with a loading
 * indicator. Each completed batch triggers a content-change event so the
 * preview updates incrementally.
 *
 * When the source document changes, only lines whose translatable text
 * actually changed are re-translated; unchanged lines reuse the previous
 * translation result, eliminating loading-indicator flicker for unmodified
 * content.
 */
class TranslatedMarkdownProvider implements TextDocumentContentProvider {
    private onDidChangeEmitter = new EventEmitter<Uri>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    /** Current document snapshot per URI (updated progressively during translation) */
    private contentCache = new Map<string, string>();

    /** Active translation generation per URI (used to cancel stale translations) */
    private activeTranslations = new Map<string, number>();

    /**
     * Previous translation results per URI: sourceText → translatedText.
     * Used to skip re-translation of unchanged lines when the document is edited.
     */
    private previousResults = new Map<string, Map<string, string>>();

    /** Pending debounce timers per URI key */
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
        let sourceDocument;
        try {
            sourceDocument = await workspace.openTextDocument(sourceUri);
        } catch (error) {
            console.error('[CommentTranslate] Failed to open source document:', sourceUri.toString(), error);
            return `<!-- Failed to open source: ${sourceUri.toString()} -->`;
        }
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
     * Passes previousResults so unchanged lines are reused without re-translation.
     */
    private startProgressiveTranslation(uri: Uri, sourceText: string): void {
        const uriKey = uri.toString();

        // Assign a unique generation id so we can detect stale translations
        const generationId = Date.now();
        this.activeTranslations.set(uriKey, generationId);

        const prevResults = this.previousResults.get(uriKey);

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
            prevResults,
        ).then(({ translated, resultsMap }) => {
            // Only update if this is still the active translation
            if (this.activeTranslations.get(uriKey) === generationId) {
                this.contentCache.set(uriKey, translated);
                this.previousResults.set(uriKey, resultsMap);
                this.onDidChangeEmitter.fire(uri);

                // Fire again after a short delay to handle the case where the
                // markdown preview webview has not fully initialized yet (e.g.
                // after VS Code restarts and restores a preview tab). The first
                // fire may be ignored if the webview is still loading.
                setTimeout(() => {
                    if (this.activeTranslations.get(uriKey) === generationId) {
                        this.onDidChangeEmitter.fire(uri);
                    }
                }, 500);
            }
        }).catch((error) => {
            console.error('[CommentTranslate] Translation failed:', error);
            if (this.activeTranslations.get(uriKey) === generationId) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const fallback = `<!-- Translation error: ${errorMessage} -->\n${sourceText}`;
                this.contentCache.set(uriKey, fallback);
                this.onDidChangeEmitter.fire(uri);
            }
        });
    }

    /**
     * Schedule a debounced re-translation for the given URI.
     *
     * Instead of immediately clearing the cache and triggering a full
     * loading-snapshot rebuild on every keystroke, this method:
     * 1. Cancels any pending debounce timer for this URI
     * 2. Bumps the generation to cancel any in-flight translation
     * 3. Keeps the existing contentCache so the preview continues to show
     *    the previous translation (no flicker)
     * 4. After CHANGE_DEBOUNCE_MS of inactivity, starts a new progressive
     *    translation that reuses previous results for unchanged lines
     */
    scheduleRetranslation(uri: Uri): void {
        const uriKey = uri.toString();

        // Cancel any pending debounce
        const existingTimer = this.debounceTimers.get(uriKey);
        if (existingTimer !== undefined) {
            clearTimeout(existingTimer);
        }

        // Bump generation to cancel any in-flight translation immediately
        this.activeTranslations.set(uriKey, Date.now());

        // Schedule the actual re-translation after debounce delay
        const timer = setTimeout(async () => {
            this.debounceTimers.delete(uriKey);

            const sourceUri = toSourceUri(uri);
            try {
                const sourceDocument = await workspace.openTextDocument(sourceUri);
                const sourceText = sourceDocument.getText();

                if (!sourceText.trim()) {
                    this.contentCache.set(uriKey, sourceText);
                    this.onDidChangeEmitter.fire(uri);
                    return;
                }

                // Start progressive translation; the old cache remains visible
                // until the first batch completes, so there is no flicker
                this.startProgressiveTranslation(uri, sourceText);
            } catch {
                // Source document may have been closed; ignore
            }
        }, CHANGE_DEBOUNCE_MS);

        this.debounceTimers.set(uriKey, timer);
    }

    /**
     * Invalidate the cache for a URI so the next provideTextDocumentContent
     * call triggers a fresh progressive translation.
     * Also clears previousResults so all lines are re-translated from scratch.
     */
    invalidate(uri: Uri): void {
        const uriKey = uri.toString();
        this.contentCache.delete(uriKey);
        this.previousResults.delete(uriKey);
        // Bump generation to cancel any in-flight translation
        this.activeTranslations.set(uriKey, Date.now());
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
        this.contentCache.clear();
        this.activeTranslations.clear();
        this.previousResults.clear();
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
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

    // On activation, refresh any translated-markdown documents that VS Code
    // restored from a previous session. We delay the refresh to give the
    // markdown preview webview time to fully initialize; firing too early
    // causes the change event to be ignored and the preview stays stuck on
    // stale loading-indicator HTML.
    setTimeout(() => {
        for (const doc of workspace.textDocuments) {
            if (doc.uri.scheme === TRANSLATED_MARKDOWN_SCHEME) {
                provider.invalidate(doc.uri);
                provider.fireChange(doc.uri);
            }
        }
    }, 2000);

    // Re-translate when the source markdown document changes (debounced).
    // Uses scheduleRetranslation which keeps the old preview visible during
    // the debounce window and reuses previous translations for unchanged lines.
    context.subscriptions.push(
        workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === "markdown" && event.document.uri.scheme === "file") {
                const translatedUri = toTranslatedUri(event.document.uri);
                provider.scheduleRetranslation(translatedUri);
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
