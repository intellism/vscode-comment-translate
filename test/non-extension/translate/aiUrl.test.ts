import { isKeyOptionalBaseUrl, normalizeAiBaseUrl } from '../../../src/translate/aiUrl';

describe('aiUrl', () => {
    test('normalizeAiBaseUrl appends /v1 when missing', () => {
        expect(normalizeAiBaseUrl('https://api.openai.com')).toBe('https://api.openai.com/v1');
        expect(normalizeAiBaseUrl('https://api.openai.com/')).toBe('https://api.openai.com/v1');
    });

    test('normalizeAiBaseUrl keeps existing /v1', () => {
        expect(normalizeAiBaseUrl('https://api.deepseek.com/v1')).toBe('https://api.deepseek.com/v1');
        expect(normalizeAiBaseUrl('https://api.deepseek.com/v1/')).toBe('https://api.deepseek.com/v1');
    });

    test('normalizeAiBaseUrl adds scheme for scheme-less hosts', () => {
        expect(normalizeAiBaseUrl('api.openai.com')).toBe('https://api.openai.com/v1');
        expect(normalizeAiBaseUrl('127.0.0.1:11434')).toBe('http://127.0.0.1:11434/v1');
        expect(normalizeAiBaseUrl('192.168.1.10:11434/v1')).toBe('http://192.168.1.10:11434/v1');
    });

    test('normalizeAiBaseUrl accepts DeepSeek official root URL', () => {
        expect(normalizeAiBaseUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1');
    });

    test('normalizeAiBaseUrl rejects empty', () => {
        expect(() => normalizeAiBaseUrl('')).toThrow(/baseUrl is empty/);
        expect(() => normalizeAiBaseUrl('   ')).toThrow(/baseUrl is empty/);
    });

    test('isKeyOptionalBaseUrl allows localhost and private LAN', () => {
        expect(isKeyOptionalBaseUrl('http://127.0.0.1:11434/v1')).toBe(true);
        expect(isKeyOptionalBaseUrl('http://localhost:11434/v1')).toBe(true);
        expect(isKeyOptionalBaseUrl('192.168.1.10:11434/v1')).toBe(true);
        expect(isKeyOptionalBaseUrl('http://10.0.0.5/v1')).toBe(true);
        expect(isKeyOptionalBaseUrl('http://172.16.0.2/v1')).toBe(true);
        expect(isKeyOptionalBaseUrl('https://api.openai.com/v1')).toBe(false);
        expect(isKeyOptionalBaseUrl('https://api.deepseek.com/v1')).toBe(false);
    });
});
