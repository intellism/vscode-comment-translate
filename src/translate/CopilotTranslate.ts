
import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
import { LanguageModelChat, LanguageModelChatMessage, LanguageModelChatSelector, lm } from 'vscode';

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

    async translate(content: string, { to = 'auto' }: ITranslateOptions): Promise<string> {
        const messages = [
            LanguageModelChatMessage.User(`translate me to ${to}. Return only translated text. Keep the rows consistent.`),
            LanguageModelChatMessage.User(content)
        ];

        let model = await this.getModel();
        if (!model) {
            return '';
        }

        const chatResponse = await model.sendRequest(messages, {});
        let texts = [];
        for await (const fragment of chatResponse.text) {
            texts.push(fragment);
        }

        return texts.join('');
    }

    link(content: string, opts: ITranslateOptions): string {
        if (content || opts) { }
        return '';
    }
}
