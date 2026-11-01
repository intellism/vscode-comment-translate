// The clear-cache command must clear the persistent cache and then refresh every view that
// keeps its own copy of translated text: browse mode, concise mode and Markdown previews.
const mockRegisterCommand = jest.fn();
const mockShowInformationMessage = jest.fn();
jest.mock('vscode', () => ({
    commands: { registerCommand: mockRegisterCommand },
    window: { showInformationMessage: mockShowInformationMessage },
}));
jest.mock('../../../src/command/changeTargetLanguage', () => ({}));
jest.mock('../../../src/command/file', () => ({}));
jest.mock('../../../src/command/replaceSelections', () => ({}));
jest.mock('../../../src/command/select', () => ({}));
jest.mock('../../../src/translate/manager', () => ({ clearTranslationCache: jest.fn().mockResolvedValue(7) }));
jest.mock('../../../src/languageFeature/decoration', () => ({ commentDecorationManager: { resetCommentDecoration: jest.fn() } }));
jest.mock('../../../src/languageFeature/concise', () => ({ conciseDecorationManager: { clearCache: jest.fn() } }));
jest.mock('../../../src/languageFeature/markdownPreview', () => ({ refreshTranslatedMarkdownPreviews: jest.fn() }));

import { registerCommands } from '../../../src/command/command';
import { clearTranslationCache } from '../../../src/translate/manager';
import { commentDecorationManager } from '../../../src/languageFeature/decoration';
import { conciseDecorationManager } from '../../../src/languageFeature/concise';
import { refreshTranslatedMarkdownPreviews } from '../../../src/languageFeature/markdownPreview';

describe('commentTranslate.clearTranslationCache command', () => {
    it('clears the cache, refreshes all views and reports the count', async () => {
        registerCommands({ subscriptions: [] } as any);
        const handler = mockRegisterCommand.mock.calls.find(c => c[0] === 'commentTranslate.clearTranslationCache')![1];
        await handler();
        expect(clearTranslationCache).toHaveBeenCalledTimes(1);
        expect(commentDecorationManager.resetCommentDecoration).toHaveBeenCalledTimes(1);
        expect(conciseDecorationManager.clearCache).toHaveBeenCalledTimes(1);
        expect(refreshTranslatedMarkdownPreviews).toHaveBeenCalledTimes(1);
        expect(mockShowInformationMessage).toHaveBeenCalledWith('Cleared 7 cached translations.');
    });
});
