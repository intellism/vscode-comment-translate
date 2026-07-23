import { window } from 'vscode';
import { AiTranslate } from '../translate/AiTranslate';
import { invalidateAiCachesNow } from '../translate/manager';
import { setSecretAiApiKey } from '../translate/aiSecrets';

export async function setAiApiKeyCommand() {
    const apiKey = await window.showInputBox({
        title: 'Comment Translate: Set AI API Key',
        prompt: 'Stored securely in SecretStorage (preferred over settings.json). Leave empty to clear.',
        password: true,
        ignoreFocusOut: true,
    });
    if (apiKey === undefined) {
        return;
    }
    await setSecretAiApiKey(apiKey.trim());
    invalidateAiCachesNow();
    window.showInformationMessage(
        apiKey.trim()
            ? 'AI API key saved to SecretStorage.'
            : 'AI API key cleared from SecretStorage.'
    );
}

export async function testAiTranslateCommand() {
    const translator = new AiTranslate();
    const sample = 'Returns the cached user profile if present.';
    try {
        const result = await translator.translate(sample, { from: 'en', to: 'zh-CN' });
        window.showInformationMessage(
            `AI Translate OK: ${result.slice(0, 80)}${result.length > 80 ? '…' : ''}`
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        window.showErrorMessage(`AI Translate failed: ${msg}`);
    }
}
