// Session-cache behaviour of cachedTranslate (src/translate/manager.ts).
// TranslateManager.translate resolves to '' when the source fails (HTTP 401/429,
// timeout, ...). A failed result must not be memoized, otherwise one transient
// failure keeps the text untranslated until a config change clears the cache.
// jest-mock-vscode has no `env`; getUserLanguage() reads env.language.
jest.mock('vscode', () => ({
    ...jest.requireActual('jest-mock-vscode').createVSCodeMock(jest),
    env: { language: 'en' },
}));
jest.mock('comment-translate-manager', () => ({
    TranslateManager: jest.fn().mockImplementation(() => ({
        translate: jest.fn(),
        opts: { from: 'auto', to: 'id' },
        maxLen: 10000,
    })),
}));
jest.mock('../../../src/translate/translateExtension', () => ({
    TranslateExtensionProvider: jest.fn().mockImplementation(() => ({
        init: jest.fn(),
    })),
}));
// Sources built on the ESM-only `got` are irrelevant to caching; stub them out.
jest.mock('../../../src/translate/GoogleTranslate', () => ({ GoogleTranslate: class {} }));
jest.mock('../../../src/translate/TranSmartTranslate', () => ({ TranSmartTranslate: class {} }));

import { ExtensionContext } from 'vscode';
import { cachedTranslate, initTranslate, translateManager } from '../../../src/translate/manager';

describe('cachedTranslate', () => {
    let translate: jest.Mock;

    beforeEach(() => {
        initTranslate({ workspaceState: {} } as unknown as ExtensionContext);
        translate = translateManager.translate as jest.Mock;
    });

    test('memoizes a successful translation', async () => {
        translate.mockResolvedValueOnce('Aktifkan interupsi');

        expect(await cachedTranslate('使能中断')).toBe('Aktifkan interupsi');
        expect(await cachedTranslate('使能中断')).toBe('Aktifkan interupsi');
        expect(translate).toHaveBeenCalledTimes(1);
    });

    test('does not memoize a failed (empty) translation', async () => {
        translate
            .mockResolvedValueOnce('')
            .mockResolvedValueOnce('Bersihkan flag tertunda');

        expect(await cachedTranslate('清除挂起标志位')).toBe('');
        expect(await cachedTranslate('清除挂起标志位')).toBe('Bersihkan flag tertunda');
        expect(translate).toHaveBeenCalledTimes(2);
    });
});
