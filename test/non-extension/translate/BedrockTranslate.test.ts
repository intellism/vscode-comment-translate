const createMock = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: '你好\n世界' }],
});
const clientCtorMock = jest.fn((_options: Record<string, unknown>) => ({ messages: { create: createMock } }));

jest.mock('@anthropic-ai/bedrock-sdk', () => ({
    AnthropicBedrockMantle: clientCtorMock,
}));

const getConfigMock = jest.fn((_key: string, def?: unknown) => def);
jest.mock('../../../src/configuration', () => ({
    getConfig: (key: string, def?: unknown) => getConfigMock(key, def),
}));

jest.mock('../../../src/lang', () => ({
    LANGS: [['zh-CN', 'Chinese (Simplified)']],
}));

import { BedrockTranslate } from '../../../src/translate/BedrockTranslate';

beforeEach(() => {
    createMock.mockClear();
    clientCtorMock.mockClear();
    getConfigMock.mockClear();
    getConfigMock.mockImplementation((_key: string, def?: unknown) => def);
});

test('translates via Bedrock with mapped language name and default model', async () => {
    const translator = new BedrockTranslate();
    const result = await translator.translate('hello\nworld', { from: 'en', to: 'zh-CN' });

    expect(result).toBe('你好\n世界');

    const params = createMock.mock.calls[0][0];
    expect(params.model).toBe('anthropic.claude-haiku-4-5');
    expect(params.messages[0].content).toContain('Chinese (Simplified)');
    expect(params.messages[0].content).toContain('hello\nworld');

    const clientOptions = clientCtorMock.mock.calls[0][0];
    expect(clientOptions.awsRegion).toBe('us-east-1');
    expect(clientOptions.awsAccessKey).toBeUndefined();
});

test('uses explicit access keys over profile when both configured', async () => {
    getConfigMock.mockImplementation((key: string, def?: unknown) => {
        const values: Record<string, string> = {
            'bedrockTranslate.accessKeyId': 'AKIAXXX',
            'bedrockTranslate.secretAccessKey': 'secret',
            'bedrockTranslate.profile': 'dev',
        };
        return values[key] ?? def;
    });

    const translator = new BedrockTranslate();
    await translator.translate('hello', { to: 'zh-CN' });

    const clientOptions = clientCtorMock.mock.calls[0][0];
    expect(clientOptions.awsAccessKey).toBe('AKIAXXX');
    expect(clientOptions.awsSecretAccessKey).toBe('secret');
    expect(clientOptions.awsProfile).toBeUndefined();
});

test('reuses client while config unchanged and rebuilds when region changes', async () => {
    const translator = new BedrockTranslate();
    await translator.translate('one', { to: 'zh-CN' });
    await translator.translate('two', { to: 'zh-CN' });
    expect(clientCtorMock).toHaveBeenCalledTimes(1);

    getConfigMock.mockImplementation((key: string, def?: unknown) =>
        key === 'bedrockTranslate.region' ? 'eu-central-1' : def,
    );
    await translator.translate('three', { to: 'zh-CN' });
    expect(clientCtorMock).toHaveBeenCalledTimes(2);
    const clientOptions = clientCtorMock.mock.calls[1][0];
    expect(clientOptions.awsRegion).toBe('eu-central-1');
});
