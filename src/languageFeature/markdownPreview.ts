import {
    commands,
    EventEmitter,
    ExtensionContext,
    TextDocumentContentProvider,
    Uri,
    window,
    workspace,
} from "vscode";
import { translateMarkdownDocument } from "../syntax/markdownDocument";
import { cachedTranslate } from "../translate/manager";

/** Custom URI scheme for translated markdown virtual documents */
export const TRANSLATED_MARKDOWN_SCHEME = "translated-markdown";

/**
 * Provides translated markdown content as a virtual document.
 *
 * When VS Code requests the content of a `translated-markdown:` URI, this
 * provider reads the corresponding source markdown file, translates its
 * displayable text via the configured translation service, and returns the
 * translated markdown with identical line count and formatting.
 */
class TranslatedMarkdownProvider implements TextDocumentContentProvider {
    private onDidChangeEmitter = new EventEmitter<Uri>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    /**
     * Fire a change event so VS Code re-fetches the translated content.
     * Called when the source document changes or the translation config changes.
     */
    fireChange(uri: Uri): void {
        this.onDidChangeEmitter.fire(uri);
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        const sourceUri = toSourceUri(uri);
        const sourceDocument = await workspace.openTextDocument(sourceUri);
        const sourceText = sourceDocument.getText();

        if (!sourceText.trim()) {
            return sourceText;
        }

        try {
            const translated = await translateMarkdownDocument(sourceText, (text) =>
                cachedTranslate(text)
            );
            return translated;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `<!-- Translation error: ${errorMessage} -->\n${sourceText}`;
        }
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
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

    // Use VS Code's built-in markdown preview to show the translated document
    await commands.executeCommand("markdown.showPreviewToSide", translatedUri);
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

    // Re-fire content change when the source markdown document is saved or changed
    context.subscriptions.push(
        workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === "markdown" && event.document.uri.scheme === "file") {
                const translatedUri = toTranslatedUri(event.document.uri);
                provider.fireChange(translatedUri);
            }
        })
    );

    // Re-fire when translation configuration changes
    context.subscriptions.push(
        workspace.onDidChangeConfiguration((event) => {
            if (
                event.affectsConfiguration("commentTranslate.targetLanguage") ||
                event.affectsConfiguration("commentTranslate.source")
            ) {
                // Refresh all open translated markdown documents
                for (const doc of workspace.textDocuments) {
                    if (doc.uri.scheme === TRANSLATED_MARKDOWN_SCHEME) {
                        provider.fireChange(doc.uri);
                    }
                }
            }
        })
    );
}
