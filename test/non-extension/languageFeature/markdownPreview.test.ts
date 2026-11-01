// refreshTranslatedMarkdownPreviews must drop the cached snapshot of open translated-markdown
// documents; otherwise reopening a preview returns the old translation for the same URI.
const mockProviders: any[] = [];
const mockTextDocuments: any[] = [];
jest.mock('vscode', () => {
    class EventEmitter {
        private listeners: Function[] = [];
        event = (l: Function) => { this.listeners.push(l); return { dispose() {} }; };
        fire = (e: unknown) => this.listeners.forEach(l => l(e));
        dispose() {}
    }
    const noop = () => ({ dispose() {} });
    return {
        EventEmitter,
        Uri: { parse: (s: string) => ({ scheme: s.split(':')[0], toString: () => s }) },
        commands: { registerCommand: noop },
        window: {},
        workspace: {
            textDocuments: mockTextDocuments,
            registerFileSystemProvider: noop,
            registerTextDocumentContentProvider: (_scheme: string, p: unknown) => { mockProviders.push(p); return { dispose() {} }; },
            openTextDocument: async () => ({ getText: () => 'hello' }),
            onDidChangeTextDocument: noop,
            onDidChangeConfiguration: noop,
        },
    };
});
const mockTranslateProgressive = jest.fn().mockResolvedValue({ translated: 'translated', resultsMap: new Map() });
jest.mock('../../../src/syntax/markdownDocument', () => ({
    buildLoadingSnapshot: () => 'loading',
    translateMarkdownDocumentProgressive: mockTranslateProgressive,
}));
jest.mock('../../../src/translate/manager', () => ({ cachedTranslate: jest.fn() }));
jest.mock('../../../src/languageFeature/translatedMarkdownFs', () => ({
    TranslatedMarkdownFileSystemProvider: class {
        setContentProvider() {}
        setFireChangeCallback() {}
    },
}));

import { Uri } from 'vscode';
import { refreshTranslatedMarkdownPreviews, registerMarkdownPreview } from '../../../src/languageFeature/markdownPreview';

const flush = () => new Promise(resolve => setImmediate(resolve));

// Each test registers its own provider; registerMarkdownPreview points the module's active provider at it.
function setup() {
    mockProviders.length = 0;
    mockTextDocuments.length = 0;
    mockTranslateProgressive.mockClear();
    registerMarkdownPreview({ subscriptions: [] } as any);
    return mockProviders[0];
}

describe('refreshTranslatedMarkdownPreviews', () => {
    it('re-translates an open preview instead of returning the cached snapshot', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        const provider = setup();
        const uri = Uri.parse('translated-markdown:/a.md');
        mockTextDocuments.push({ uri });

        expect(await provider.provideTextDocumentContent(uri)).toBe('loading');
        await flush();
        expect(await provider.provideTextDocumentContent(uri)).toBe('translated');
        expect(mockTranslateProgressive).toHaveBeenCalledTimes(1);

        refreshTranslatedMarkdownPreviews();

        expect(await provider.provideTextDocumentContent(uri)).toBe('loading');
        expect(mockTranslateProgressive).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });

    it('also drops the snapshot of a preview whose document is closed', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        const provider = setup();
        // Not in mockTextDocuments: the preview document is closed.
        const closedUri = Uri.parse('translated-markdown:/closed.md');

        expect(await provider.provideTextDocumentContent(closedUri)).toBe('loading');
        await flush();
        expect(await provider.provideTextDocumentContent(closedUri)).toBe('translated');
        expect(mockTranslateProgressive).toHaveBeenCalledTimes(1);

        refreshTranslatedMarkdownPreviews();

        expect(await provider.provideTextDocumentContent(closedUri)).toBe('loading');
        expect(mockTranslateProgressive).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });
});
