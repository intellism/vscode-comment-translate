export type AiPresetId = 'openai' | 'deepseek' | 'ollama' | 'custom';

export interface AiPreset {
    id: AiPresetId;
    title: string;
    baseUrl: string;
    defaultModel?: string;
}

export const AI_PRESETS: Record<Exclude<AiPresetId, 'custom'>, AiPreset> = {
    openai: {
        id: 'openai',
        title: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
    },
    deepseek: {
        id: 'deepseek',
        title: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
    },
    ollama: {
        id: 'ollama',
        title: 'Ollama (local)',
        baseUrl: 'http://127.0.0.1:11434/v1',
        defaultModel: 'qwen2.5',
    },
};

export function resolveAiBaseUrl(preset: string, configuredBaseUrl: string): string {
    if (preset && preset !== 'custom' && preset in AI_PRESETS) {
        return AI_PRESETS[preset as Exclude<AiPresetId, 'custom'>].baseUrl;
    }
    return configuredBaseUrl;
}
