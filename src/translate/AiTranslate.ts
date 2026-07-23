import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
import { getConfig } from '../configuration';
import { chatCompletions } from './aiClient';
import { cleanAiTranslation, getAiTranslateMessages } from './aiPrompt';
import { isKeyOptionalBaseUrl } from './aiUrl';
import { getAiRequestEpoch } from './aiEpoch';
import { resolveAiBaseUrl } from './aiPresets';
import { getSecretAiApiKey } from './aiSecrets';

export class AiTranslate implements ITranslate {
    /** Prefer larger chunks so comment context stays in one request. */
    readonly maxLen = 3000;

    private async requireConfig(): Promise<{
        baseUrl: string;
        apiKey: string;
        model: string;
        temperature: number;
        maxTokens: number;
        timeout: number;
        systemPrompt: string;
        style: string;
    }> {
        const preset = getConfig<string>('ai.preset', 'custom');
        const configuredBaseUrl = getConfig<string>('ai.baseUrl', 'https://api.openai.com/v1');
        const baseUrl = resolveAiBaseUrl(preset, configuredBaseUrl);
        const settingsKey = getConfig<string>('ai.apiKey', '');
        const secretKey = await getSecretAiApiKey();
        const apiKey = secretKey || settingsKey;
        const model = getConfig<string>('ai.model', 'gpt-4o-mini');
        const temperature = getConfig<number>('ai.temperature', 0.2);
        const maxTokens = getConfig<number>('ai.maxTokens', 4096);
        const timeout = getConfig<number>('ai.timeout', 30000);
        const systemPrompt = getConfig<string>('ai.systemPrompt', '');
        const style = getConfig<string>('ai.style', 'natural');

        if (!baseUrl?.trim()) {
            throw new Error(
                'AI Translate is not configured: set commentTranslate.ai.baseUrl (and apiKey / model).'
            );
        }

        // Local / LAN servers (e.g. Ollama) often need no key; remote APIs usually do.
        if (!apiKey?.trim() && !isKeyOptionalBaseUrl(baseUrl)) {
            throw new Error(
                'AI Translate: apiKey is missing. Run "Comment Translate: Set AI API Key" or set commentTranslate.ai.apiKey.'
            );
        }

        if (!model?.trim()) {
            throw new Error('AI Translate: model is missing. Set commentTranslate.ai.model.');
        }

        return { baseUrl, apiKey, model, temperature, maxTokens, timeout, systemPrompt, style };
    }

    async translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        const epoch = getAiRequestEpoch();
        const conf = await this.requireConfig();
        const { messages } = getAiTranslateMessages(content, from, to, {
            systemPromptOverride: conf.systemPrompt,
            style: conf.style,
        });

        const raw = await chatCompletions({
            baseUrl: conf.baseUrl,
            apiKey: conf.apiKey,
            model: conf.model,
            messages,
            temperature: conf.temperature,
            maxTokens: conf.maxTokens,
            timeout: conf.timeout,
        });

        // Prevent TranslateManager from persisting a stale result after settings change mid-request.
        if (epoch !== getAiRequestEpoch()) {
            throw new Error('AI Translate: settings changed during request; discarded stale result.');
        }

        return cleanAiTranslation(raw);
    }

    link(_content: string, _opts: ITranslateOptions): string {
        return `[AI](command:workbench.action.openSettings?%5B%22commentTranslate.ai%22%5D)`;
    }

    isSupported() {
        return true;
    }
}
