// Browse/immersive views map the translation back onto comment lines. A source that merges lines
// (returns fewer lines than it was given) must still produce one decoration per source line.
jest.mock('../../../src/extension', () => ({
    ctx: { asAbsolutePath: (p: string) => p },
}));

jest.mock('../../../src/configuration', () => ({
    getConfig: jest.fn(),
}));

jest.mock('../../../src/translate/manager', () => ({
    translateManager: { opts: { to: 'zh-CN' }, link: jest.fn() },
    autoMutualTranslate: jest.fn(),
    cachedTranslate: jest.fn(),
}));

jest.mock('../../../src/languageFeature/codelen', () => ({
    usePlaceholderCodeLensProvider: () => ({ append: jest.fn() }),
}));

import { window, Range, Uri } from 'vscode';
import { createTextDocument } from 'jest-mock-vscode';
import { CommentDecoration, MarkdownDecoration } from '../../../src/languageFeature/commentDecoration';
import { cachedTranslate } from '../../../src/translate/manager';
import { ICommentBlock } from '../../../src/interface';

const code = ['First part of the comment.', 'Second part of the comment.', 'Third part of the comment.'].join('\n');

async function decorate(translated: string, inplace: boolean, source: string = code, Decoration: typeof CommentDecoration = CommentDecoration) {
    (cachedTranslate as jest.Mock).mockResolvedValue(translated);
    const doc = createTextDocument(Uri.file('sample.txt'), source, 'plaintext');
    const setDecorations = jest.fn();
    const decorated = new Promise<void>(resolve => {
        setDecorations.mockImplementation((_type, options: any[]) => {
            if (options.length > 0 && options[0].renderOptions) {
                resolve();
            }
        });
    });
    (window as any).createTextEditorDecorationType = jest.fn(() => ({ dispose: jest.fn() }));
    (window as any).visibleTextEditors = [{ document: doc, setDecorations }];
    const lines = source.split('\n');
    const block = { comment: source, range: new Range(0, 0, lines.length - 1, lines[lines.length - 1].length) } as unknown as ICommentBlock;
    // The constructor starts translate(), which ends with the first setDecorations call that carries
    // content. Waiting for that call needs no timer.
    new Decoration(block, doc, inplace);
    await decorated;
    // The last setDecorations call that carries content holds the translated lines.
    const calls = setDecorations.mock.calls.filter(([, options]) => options.length > 0 && options[0].renderOptions);
    const options = calls[calls.length - 1][1] as any[];
    return options.map(option => ({
        line: option.range.start.line,
        text: (option.renderOptions.before.contentText as string).trim(),
    }));
}

describe('CommentDecoration with a source that merges lines', () => {
    const merged = '注释的第一部分。注释的第二部分。注释的第三部分。';

    it('shows a translated line under every source line in browse mode', async () => {
        const shown = await decorate(merged, false);
        // Browse mode puts each translated line under its source line: source lines 0..2 -> 1..3.
        expect(shown.map(item => item.line)).toEqual([1, 2, 3]);
        expect(shown.every(item => item.text.length > 0)).toBe(true);
        expect(shown.map(item => item.text).join('')).toBe(merged);
    });

    it('replaces every source line in immersive mode', async () => {
        const shown = await decorate(merged, true);
        expect(shown.map(item => item.line)).toEqual([0, 1, 2]);
        expect(shown.every(item => item.text.length > 0)).toBe(true);
        expect(shown.map(item => item.text).join('')).toBe(merged);
    });
});

describe('CommentDecoration line alignment', () => {
    it('keeps a line-for-line translation under its own line when a source line is blank', async () => {
        const source = ['First part.', '  ', 'Third part.'].join('\n');
        const shown = await decorate('一。\n\n三。', false, source);
        expect(shown.map(item => item.text)).toEqual(['一。', '三。']);
        // Browse mode: source lines 0 and 2 -> 1 and 3.
        expect(shown.map(item => item.line)).toEqual([1, 3]);
    });

    it('spreads a one-line translation over a long plain-text block', async () => {
        const source = Array.from({ length: 40 }, (_, i) => `Line number ${i + 1} of a long plain text file.`).join('\n');
        const translated = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 行：这是一个很长的纯文本文件。`).join(' ');
        const shown = await decorate(translated, false, source);
        expect(shown.length).toBe(40);
        expect(shown.every(item => item.text.length > 0)).toBe(true);
    });
});

describe('MarkdownDecoration with a source that merges lines', () => {
    it('spreads a one-line translation over the Markdown lines', async () => {
        const source = ['# First part', 'Second part of the text.', 'Third part of the text.'].join('\n');
        const merged = '第一部分。第二部分。第三部分。';
        const shown = await decorate(merged, false, source, MarkdownDecoration);
        expect(shown.map(item => item.line)).toEqual([1, 2, 3]);
        expect(shown.every(item => item.text.length > 0)).toBe(true);
        expect(shown.map(item => item.text).join('')).toBe(merged);
    });
});
