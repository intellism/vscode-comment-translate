import { cleanAiTranslation, getAiTranslateMessages, getSystemPromptForStyle } from '../../../src/translate/aiPrompt';
import { resolveAiBaseUrl } from '../../../src/translate/aiPresets';

describe('aiPrompt', () => {
    test('getAiTranslateMessages builds system and user prompts', () => {
        const { messages, systemPrompt, userPrompt } = getAiTranslateMessages('Hello', 'en', 'zh-CN');
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
        expect(systemPrompt).toContain('software engineers');
        expect(userPrompt).toContain('Chinese (Simplified)');
        expect(userPrompt).toContain('Hello');
    });

    test('custom systemPrompt overrides style', () => {
        const { systemPrompt } = getAiTranslateMessages('x', 'en', 'ja', {
            systemPromptOverride: 'Custom prompt',
            style: 'literal',
        });
        expect(systemPrompt).toBe('Custom prompt');
    });

    test('style selects different built-in prompts', () => {
        expect(getSystemPromptForStyle('literal')).toContain('literal accuracy');
        expect(getSystemPromptForStyle('concise')).toContain('narrow hover');
        expect(getSystemPromptForStyle('natural')).toContain('natural, fluent');
    });

    test('cleanAiTranslation strips fences and labels', () => {
        expect(cleanAiTranslation('```\n你好\n```')).toBe('你好');
        expect(cleanAiTranslation('Translation: hello')).toBe('hello');
        expect(cleanAiTranslation('译文：世界')).toBe('世界');
        expect(cleanAiTranslation('```text\nfoo\n```')).toBe('foo');
    });
});

describe('aiPresets', () => {
    test('resolveAiBaseUrl uses preset url unless custom', () => {
        expect(resolveAiBaseUrl('deepseek', 'https://ignored')).toBe('https://api.deepseek.com');
        expect(resolveAiBaseUrl('custom', 'https://my.proxy/v1')).toBe('https://my.proxy/v1');
        expect(resolveAiBaseUrl('ollama', '')).toBe('http://127.0.0.1:11434/v1');
    });
});
