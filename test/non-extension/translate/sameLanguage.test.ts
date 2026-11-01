// Language checks in src/translate/manager.ts: autoMutualTranslate uses isSameLanguage,
// cachedTranslate does no language check.
// jest-mock-vscode has no `env`; getUserLanguage() reads env.language.
jest.mock('vscode', () => ({
    ...jest.requireActual('jest-mock-vscode').createVSCodeMock(jest),
    env: { language: 'en' },
}));
jest.mock('comment-translate-manager', () => ({
    TranslateManager: jest.fn().mockImplementation(() => ({
        translate: jest.fn().mockResolvedValue(''),
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
jest.mock('../../../src/translate/TranSmartTranslate', () => ({ TranSmartTranslate: class {} }));

import { ExtensionContext } from 'vscode';
import * as configuration from '../../../src/configuration';
import * as lang from '../../../src/lang';
import { autoMutualTranslate, cachedTranslate, initTranslate, translateManager } from '../../../src/translate/manager';

const indonesian = 'Aktifkan interupsi timer lalu bersihkan flag tertunda sebelum masuk mode tidur';

describe('same-language text', () => {
    let translate: jest.Mock;

    beforeEach(() => {
        jest.restoreAllMocks();
        initTranslate({ workspaceState: {} } as unknown as ExtensionContext);
        translate = translateManager.translate as jest.Mock;
    });

    test('cachedTranslate sends text even when the detector reports the target language', async () => {
        // cachedTranslate does no language check; cld3 does report short English text such as "Main loop" as "id".
        jest.spyOn(lang, 'detectLanguage').mockResolvedValue('id');
        translate.mockResolvedValueOnce('Loop utama');

        expect(await cachedTranslate('Main loop', { to: 'id' })).toBe('Loop utama');
        expect(translate).toHaveBeenCalledTimes(1);
    });

    test('autoMutualTranslate swaps direction when cld3 reports Indonesian text as Malay', async () => {
        jest.spyOn(lang, 'detectLanguage').mockResolvedValue('ms');
        jest.spyOn(configuration, 'getConfig').mockImplementation(
            (key: string, def?: unknown) => (key === 'mutualTranslate' ? true : def) as never
        );
        translate.mockResolvedValueOnce('Enable timer interrupt');

        await autoMutualTranslate(indonesian, { to: 'id', from: 'en' });

        expect(translate).toHaveBeenCalledWith(indonesian, { from: 'en', to: 'en' });
    });
});
