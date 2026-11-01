// clearTranslationCache (src/translate/manager.ts) must drop the session cache and only the
// workspaceState keys written by TranslateManager (`${source}-from[${from}]to[${to}]-${text}`).
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
// Sources built on the ESM-only `got` are irrelevant here; stub them out.
jest.mock('../../../src/translate/GoogleTranslate', () => ({ GoogleTranslate: class {} }));
jest.mock('../../../src/translate/BingTranslate', () => ({ BingTranslate: class {} }));
jest.mock('../../../src/translate/CopilotTranslate', () => ({ CopilotTranslate: class {} }));
jest.mock('../../../src/translate/TranSmartTranslate', () => ({ TranSmartTranslate: class {} }));

import { ExtensionContext } from 'vscode';
import { cachedTranslate, clearTranslationCache, initTranslate, translateManager } from '../../../src/translate/manager';

describe('clearTranslationCache', () => {
    const libraryKeys = [
        'Google-from[auto]to[id]-hello',
        'Copilot-from[en]to[zh-CN]-multi\nline text',
    ];
    const foreignKeys = ['commentTranslate.lastVersion', 'from[auto]to[id]', 'note-from[auto]-to[id]-x'];
    let store: Map<string, unknown>;
    let workspaceState: { keys: jest.Mock; get: jest.Mock; update: jest.Mock };

    beforeEach(() => {
        store = new Map<string, unknown>([...libraryKeys, ...foreignKeys].map(key => [key, 'value']));
        workspaceState = {
            keys: jest.fn(() => [...store.keys()]),
            get: jest.fn((key: string) => store.get(key)),
            update: jest.fn(async (key: string, value: unknown) => {
                if (value === undefined) {
                    store.delete(key);
                } else {
                    store.set(key, value);
                }
            }),
        };
        initTranslate({ workspaceState } as unknown as ExtensionContext);
    });

    test('removes only the keys written by TranslateManager and returns their count', async () => {
        expect(await clearTranslationCache()).toBe(libraryKeys.length);
        expect([...store.keys()].sort()).toEqual([...foreignKeys].sort());
    });

    test('returns 0 and writes nothing when there is nothing to clear', async () => {
        await clearTranslationCache();
        workspaceState.update.mockClear();

        expect(await clearTranslationCache()).toBe(0);
        expect(workspaceState.update).not.toHaveBeenCalled();
    });

    test('empties the session cache so the next call translates again', async () => {
        const translate = translateManager.translate as jest.Mock;
        translate.mockResolvedValue('Hasil lama');

        await cachedTranslate('清除缓存测试');
        await cachedTranslate('清除缓存测试');
        expect(translate).toHaveBeenCalledTimes(1);

        await clearTranslationCache();
        await cachedTranslate('清除缓存测试');
        expect(translate).toHaveBeenCalledTimes(2);
    });
});
