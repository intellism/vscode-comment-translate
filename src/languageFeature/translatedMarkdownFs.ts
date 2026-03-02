import * as vscode from "vscode";

/**
 * Callback that provides translated markdown content for a given URI.
 * Returns the translated text if available, or undefined to fall back
 * to reading the source file from disk.
 */
export type TranslatedContentProvider = (uri: vscode.Uri) => Promise<string | undefined>;

/**
 * Callback to fire a content-change event for a URI, ensuring the
 * TextDocumentContentProvider gets a chance to provide updated content
 * after the FileSystemProvider has served the initial read.
 */
export type FireChangeCallback = (uri: vscode.Uri) => void;

/**
 * A read-only FileSystemProvider for the `translated-markdown` scheme.
 *
 * Serves two purposes:
 * 1. For the translated markdown document itself (identified by having a
 *    query parameter): delegates to the `TranslatedContentProvider` callback
 *    to return translated content. This ensures the first `openTextDocument`
 *    call gets the translated/loading content rather than the raw source.
 * 2. For resource files (images, SVGs, etc.) referenced via relative paths:
 *    maps the URI path to the local file system so the markdown preview
 *    webview can load them.
 */
export class TranslatedMarkdownFileSystemProvider implements vscode.FileSystemProvider {

    private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

    private contentProvider: TranslatedContentProvider | undefined;
    private fireChangeCallback: FireChangeCallback | undefined;

    /**
     * Set the callback that provides translated content for markdown documents.
     */
    setContentProvider(provider: TranslatedContentProvider): void {
        this.contentProvider = provider;
    }

    /**
     * Set the callback to fire content-change events. This is used to
     * notify the TextDocumentContentProvider after a readFile call so
     * the preview can refresh with the latest translated content.
     */
    setFireChangeCallback(callback: FireChangeCallback): void {
        this.fireChangeCallback = callback;
    }

    /**
     * Map a translated-markdown URI to the corresponding real file URI.
     * The path portion of the URI mirrors the source file's absolute path.
     */
    private toFileUri(uri: vscode.Uri): vscode.Uri {
        return vscode.Uri.file(uri.path);
    }

    /**
     * Check whether the URI represents a translated markdown document
     * (as opposed to a resource file like an image). Translated document
     * URIs carry the source file URI in their query parameter.
     */
    private isTranslatedDocument(uri: vscode.Uri): boolean {
        return uri.query.length > 0;
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        if (this.isTranslatedDocument(uri)) {
            // For the translated document, return a synthetic stat.
            // The actual content is provided by the content provider.
            return {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 0,
            };
        }
        const fileUri = this.toFileUri(uri);
        return vscode.workspace.fs.stat(fileUri);
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        if (this.isTranslatedDocument(uri) && this.contentProvider) {
            const content = await this.contentProvider(uri);
            if (content !== undefined) {
                // Schedule a delayed change event so the
                // TextDocumentContentProvider can refresh the preview with
                // the latest content. This handles the case where the
                // preview becomes visible again after being hidden — the
                // webview re-reads via FileSystemProvider but needs a
                // subsequent change event to pick up the
                // TextDocumentContentProvider's content.
                if (this.fireChangeCallback) {
                    const callback = this.fireChangeCallback;
                    setTimeout(() => callback(uri), 300);
                }
                return new TextEncoder().encode(content);
            }
        }
        // For resource files (images, etc.) or when no translated content
        // is available yet, read from the real file system.
        const fileUri = this.toFileUri(uri);
        return vscode.workspace.fs.readFile(fileUri);
    }

    async readDirectory(_uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return [];
    }

    watch(_uri: vscode.Uri): vscode.Disposable {
        return new vscode.Disposable(() => { /* no-op */ });
    }

    async createDirectory(_uri: vscode.Uri): Promise<void> {
        throw vscode.FileSystemError.NoPermissions("Translated markdown is read-only");
    }

    async writeFile(_uri: vscode.Uri): Promise<void> {
        throw vscode.FileSystemError.NoPermissions("Translated markdown is read-only");
    }

    async delete(_uri: vscode.Uri): Promise<void> {
        throw vscode.FileSystemError.NoPermissions("Translated markdown is read-only");
    }

    async rename(_oldUri: vscode.Uri, _newUri: vscode.Uri): Promise<void> {
        throw vscode.FileSystemError.NoPermissions("Translated markdown is read-only");
    }

    dispose(): void {
        this.onDidChangeFileEmitter.dispose();
    }
}
