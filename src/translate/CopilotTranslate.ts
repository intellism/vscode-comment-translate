import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
import { LanguageModelChat, LanguageModelChatMessage, LanguageModelChatSelector, lm } from 'vscode';
import { getConfig } from '../configuration';
import { getAiRequestEpoch } from './aiEpoch';
import { cleanAiTranslation, getAiTranslateMessages } from './aiPrompt';

export class CopilotTranslate implements ITranslate {

    private _model: LanguageModelChat | undefined;

    public maxLen = 1000;
    constructor() { }

    async getModel(): Promise<LanguageModelChat | undefined> {
        if (this._model) {
            return this._model;
        }
        const MODEL_SELECTOR: LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };
        const models = await lm.selectChatModels(MODEL_SELECTOR);
        this._model = models.find(m => m.family === MODEL_SELECTOR.family && m.vendor === MODEL_SELECTOR.vendor);
        return this._model;
    }

    async translate(content: string, { from = 'auto', to = 'auto' }: ITranslateOptions): Promise<string> {
        const epoch = getAiRequestEpoch();
        const style = getConfig<string>('ai.style', 'natural');
        const systemPromptOverride = getConfig<string>('ai.systemPrompt', '');
        const { messages } = getAiTranslateMessages(content, from, to, {
            style,
            systemPromptOverride,
        });

        const lmMessages = messages.map((m) =>
            m.role === 'system'
                ? LanguageModelChatMessage.User(m.content, 'system')
                : LanguageModelChatMessage.User(m.content, 'user')
        );

        const model = await this.getModel();
        if (!model) {
            throw new Error(
                'Github Copilot translate: no Copilot chat model available. Install/enable GitHub Copilot Chat, or switch to AI Translate.'
            );
        }

        const chatResponse = await model.sendRequest(lmMessages, {});
        const texts: string[] = [];
        for await (const fragment of chatResponse.text) {
            texts.push(fragment);
        }

        if (epoch !== getAiRequestEpoch()) {
            throw new Error('Github Copilot translate: settings changed during request; discarded stale result.');
        }

        return cleanAiTranslation(texts.join(''));
    }

    link(_content: string, _opts: ITranslateOptions): string {
        return '';
    }
}
