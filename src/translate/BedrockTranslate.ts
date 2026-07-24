import { BaseTranslate } from './baseTranslate';
import { ITranslateOptions } from 'comment-translate-manager';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import type { BedrockMantleClientOptions } from '@anthropic-ai/bedrock-sdk';
import { getConfig } from '../configuration';
import { LANGS } from '../lang';

const LANG_NAMES: Map<string, string> = new Map(LANGS as [string, string][]);

const SYSTEM_PROMPT =
    'You are a professional translation engine in the IT field. ' +
    'Do not translate noun phrases and programming domain terms. ' +
    'Preserve the line structure of the input exactly: output the same number of lines, translated line by line. ' +
    'Return only the translated text, with no explanations.';

export class BedrockTranslate extends BaseTranslate {
    override maxLen = 1000;

    private _client: AnthropicBedrockMantle | undefined;
    private _clientKey = '';

    private _getClient(): AnthropicBedrockMantle {
        const region = getConfig<string>('bedrockTranslate.region', 'us-east-1');
        const accessKeyId = getConfig<string>('bedrockTranslate.accessKeyId', '');
        const secretAccessKey = getConfig<string>('bedrockTranslate.secretAccessKey', '');
        const profile = getConfig<string>('bedrockTranslate.profile', '');
        const key = `${region}|${accessKeyId}|${secretAccessKey}|${profile}`;
        if (!this._client || this._clientKey !== key) {
            const options: BedrockMantleClientOptions = {
                awsRegion: region,
                timeout: 30_000,
                maxRetries: 1,
            };
            // 凭证优先级: 显式密钥 > 命名 profile > 默认 AWS 凭证链
            if (accessKeyId && secretAccessKey) {
                options.awsAccessKey = accessKeyId;
                options.awsSecretAccessKey = secretAccessKey;
            } else if (profile) {
                options.awsProfile = profile;
            }
            this._client = new AnthropicBedrockMantle(options);
            this._clientKey = key;
        }
        return this._client;
    }

    async _translate(content: string, { to = 'auto' }: ITranslateOptions): Promise<string> {
        const model = getConfig<string>('bedrockTranslate.model', 'anthropic.claude-haiku-4-5');
        const target = to === 'auto' ? 'English' : (LANG_NAMES.get(to) || to);

        const response = await this._getClient().messages.create({
            model,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: `Translate the following text to ${target}:\n${content}` },
            ],
        });

        return response.content
            .map((block) => (block.type === 'text' ? block.text : ''))
            .join('');
    }
}
