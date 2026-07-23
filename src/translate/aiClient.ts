import got, { HTTPError } from 'got';
import { normalizeAiBaseUrl } from './aiUrl';

export interface AiChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AiChatRequestOptions {
    baseUrl: string;
    apiKey?: string;
    model: string;
    messages: AiChatMessage[];
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

interface ChatCompletionsResponse {
    choices?: Array<{
        message?: {
            content?: string | null;
        };
        finish_reason?: string | null;
    }>;
    error?: {
        message?: string;
    };
}

export async function chatCompletions(options: AiChatRequestOptions): Promise<string> {
    const {
        apiKey,
        model,
        messages,
        temperature = 0.2,
        maxTokens = 4096,
        timeout = 30000,
    } = options;

    if (!model?.trim()) {
        throw new Error('AI Translate: model is empty. Set commentTranslate.ai.model.');
    }

    const baseUrl = normalizeAiBaseUrl(options.baseUrl);
    const endpoint = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey?.trim()) {
        headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    try {
        const res = await got.post(endpoint, {
            headers,
            json: {
                model: model.trim(),
                temperature,
                max_tokens: maxTokens,
                messages,
            },
            timeout: { request: timeout },
            responseType: 'json',
        }).json<ChatCompletionsResponse>();

        if (res.error?.message) {
            throw new Error(`AI Translate API error: ${res.error.message}`);
        }

        const choice = res.choices?.[0];
        const content = choice?.message?.content;
        if (content == null || content === '') {
            throw new Error('AI Translate: empty response from model.');
        }
        if (choice?.finish_reason === 'length') {
            throw new Error(
                'AI Translate: response truncated (finish_reason=length). Increase commentTranslate.ai.maxTokens or shorten the input.'
            );
        }
        return content;
    } catch (err) {
        if (err instanceof HTTPError) {
            const status = err.response.statusCode;
            let detail = '';
            try {
                const body = err.response.body as ChatCompletionsResponse | string;
                if (typeof body === 'string') {
                    detail = body.slice(0, 300);
                } else if (body?.error?.message) {
                    detail = body.error.message;
                }
            } catch {
                // ignore parse errors
            }
            if (status === 401 || status === 403) {
                throw new Error(
                    `AI Translate: authentication failed (${status}). Check commentTranslate.ai.apiKey.${detail ? ` ${detail}` : ''}`
                );
            }
            throw new Error(
                `AI Translate: HTTP ${status}.${detail ? ` ${detail}` : ''} Check baseUrl / model / network.`
            );
        }
        if (err instanceof Error) {
            if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(err.message)) {
                throw new Error(
                    `AI Translate: request timed out after ${timeout}ms. Increase commentTranslate.ai.timeout or check network.`
                );
            }
            throw err;
        }
        throw new Error(`AI Translate: unexpected error: ${String(err)}`);
    }
}

