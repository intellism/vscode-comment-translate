import { SecretStorage } from 'vscode';

export const AI_API_KEY_SECRET = 'commentTranslate.ai.apiKey';

let secrets: SecretStorage | undefined;

export function initAiSecrets(storage: SecretStorage) {
    secrets = storage;
}

export async function getSecretAiApiKey(): Promise<string> {
    if (!secrets) {
        return '';
    }
    return (await secrets.get(AI_API_KEY_SECRET)) || '';
}

export async function setSecretAiApiKey(apiKey: string): Promise<void> {
    if (!secrets) {
        throw new Error('AI Translate: SecretStorage is not initialized.');
    }
    if (!apiKey) {
        await secrets.delete(AI_API_KEY_SECRET);
        return;
    }
    await secrets.store(AI_API_KEY_SECRET, apiKey);
}
