import { ChatContext, ChatRequest, ChatResponseStream, CancellationToken, LanguageModelChatSelector, LanguageModelChat, lm, LanguageModelChatMessage, chat, ExtensionContext, Uri } from "vscode";
import { getConfig } from "../configuration";
import { getTranslatePrompt, getVarPrompt, getWordPrompt, getHoverTranslatePrompt } from "./prompt";

let model: LanguageModelChat | undefined;
export async function getModel(): Promise<LanguageModelChat | undefined> {
    if (!model) {
        const MODEL_SELECTOR: LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };
        const models = await lm.selectChatModels(MODEL_SELECTOR);
        model = models.find(m => m.family === MODEL_SELECTOR.family && m.vendor === MODEL_SELECTOR.vendor);
    }

    return model;
}

export interface TranslateStrategy {
    execute(request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken): Promise<void>;
}

class DefaultTranslateStrategy implements TranslateStrategy {
    async execute(request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken): Promise<void> {
        // 默认翻译策略的实现
        let model = await getModel();
        if (!model) {
            return;
        }

        let targetLanguage = getConfig('targetLanguage', 'en');

        let { systemPrompt, userPrompt } = getTranslatePrompt(targetLanguage, request.prompt);
        // 发送请求，翻译到目标语言
        const messages = [
            LanguageModelChatMessage.User(systemPrompt, 'system'),
            LanguageModelChatMessage.User(userPrompt, 'user')
        ];
        const chatResponse = await model.sendRequest(messages, {});

        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
        }
    }
}

class WordTranslateStrategy implements TranslateStrategy {
    async execute(request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken): Promise<void> {

        let model = await getModel();
        if (!model) {
            return;
        }
        let targetLanguage = getConfig('targetLanguage', 'en');

        let { systemPrompt, userPrompt } = getWordPrompt(targetLanguage, request.prompt);

        const messages = [
            LanguageModelChatMessage.Assistant(systemPrompt, 'system'),
            LanguageModelChatMessage.User(userPrompt),
        ];
        const chatResponse = await model.sendRequest(messages, {});
        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
        }
    }
}

class VariableTranslateStrategy implements TranslateStrategy {
    async execute(request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken): Promise<void> {

        let model = await getModel();
        if (!model) {
            return;
        }

        let { systemPrompt, userPrompt } = getVarPrompt(request.prompt);

        const messages = [
            LanguageModelChatMessage.Assistant(systemPrompt, 'system'),
            LanguageModelChatMessage.User(userPrompt),
        ];
        const chatResponse = await model.sendRequest(messages, {});
        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
        }
    }
}

class StrategyRegistry {
    private strategies: Map<string, TranslateStrategy> = new Map();

    register(command: string, strategy: TranslateStrategy): void {
        this.strategies.set(command, strategy);
    }

    getStrategy(command: string): TranslateStrategy | undefined {
        return this.strategies.get(command);
    }
}

const strategyRegistry = new StrategyRegistry();
strategyRegistry.register('default', new DefaultTranslateStrategy());
strategyRegistry.register('word', new WordTranslateStrategy());
strategyRegistry.register('var', new VariableTranslateStrategy());

export async function translate(request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken) {

    let strategy;
    if (request.command) {
        strategy = strategyRegistry.getStrategy(request.command);
    } else {
        strategy = strategyRegistry.getStrategy('default');
    }

    if (strategy) {
        return strategy.execute(request, context, stream, token);
    }
}


export function registerChatParticipant(ctx: ExtensionContext) {
    const translateParticipant = chat.createChatParticipant('intellism.translate', translate);
    translateParticipant.iconPath = Uri.joinPath(ctx.extensionUri, 'icon.png');

    ctx.subscriptions.push(translateParticipant);
}


export async function textTranslate(text: string, to: string) {
    let model = await getModel();
    if (!model) {
        return;
    }

    let { systemPrompt, userPrompt } = getHoverTranslatePrompt(to, text);
    // 发送请求，翻译到目标语言
    const messages = [
        LanguageModelChatMessage.User(systemPrompt, 'system'),
        LanguageModelChatMessage.User(userPrompt, 'user')
    ];
    const chatResponse = await model.sendRequest(messages, {});

    let texts = [];

    for await (const fragment of chatResponse.text) {
        texts.push(fragment);
    }

    return texts.join('');
}
