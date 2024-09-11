import { ITranslateOptions, TranslateManager } from "comment-translate-manager";
import { getConfig, onConfigChange } from "../configuration";
import { env, ExtensionContext } from "vscode";
import { ITranslateConfig, TranslateExtensionProvider } from "./translateExtension";
import { GoogleTranslate } from "./GoogleTranslate";
import { BingTranslate } from "./BingTranslate";
import { detectLanguage } from "../lang";
import { CopilotTranslate } from "./CopilotTranslate";


export let translateManager: TranslateManager;
export let translateExtensionProvider: TranslateExtensionProvider

export function initTranslate(context: ExtensionContext) {

    let userLanguage = getUserLanguage();
    const targetLanguage = getConfig('targetLanguage', userLanguage);
    const sourceLanguage = getConfig('sourceLanguage', 'auto');
    // 最多单次可以翻译10000字符。 内部会分拆请求翻译服务。
    translateManager = new TranslateManager(context.workspaceState, getConfig<number>('maxTranslationLength', 10000), { from: sourceLanguage, to: targetLanguage });
    onConfigChange('maxTranslationLength', (maxLen: number) => {
        translateManager.maxLen = maxLen;
    });
    onConfigChange('targetLanguage', (targetLanguage: string) => {
        translateManager.opts.to = targetLanguage;
    });
    onConfigChange('sourceLanguage', (sourceLanguage: string) => {
        translateManager.opts.from = sourceLanguage;
    });

    const buildInTranslate: ITranslateConfig[] = [{
        title: 'Google translate',
        ctor: GoogleTranslate,
        translate: 'Google'
    },
    {
        title: 'Bing translate',
        ctor: BingTranslate,
        translate: 'Bing'
    },
    {
        title: 'Github Copilot translate',
        ctor: CopilotTranslate,
        translate: 'Copilot'
    }];
    translateExtensionProvider = new TranslateExtensionProvider(translateManager, buildInTranslate);
    translateExtensionProvider.init(getConfig<string>('source', ''));

    return translateManager;
}


/**
 * Automatic translation, which automatically detects languages based on source code
 * @param text Text to be translated
 * @param opts Select target and source languages for translation
 * @returns Translated text
 */
export async function autoMutualTranslate(text: string, opts?: ITranslateOptions): Promise<string> {
    let targetLanguage = opts?.to || translateManager.opts.to || 'auto';
    let sourceLanguage = opts?.from || translateManager.opts.from || 'en';

    let detectedLanguage = await detectLanguage(text);
    if (targetLanguage.indexOf(detectedLanguage) === 0) {
        targetLanguage = sourceLanguage;
        // In the case of automatic detection, the target language for translation cannot be auto
        if (targetLanguage === 'auto') targetLanguage = 'en';
    }
    return translateManager.translate(text, { from: opts?.from, to: targetLanguage });
}


export function getUserLanguage() {
    let userLanguage = env.language;

    let langMaps: Map<string, string> = new Map([
        ['zh-cn', 'zh-CN'],
        ['zh-tw', 'zh-TW'],
    ]);
    // 修复语言代码不一致
    if (langMaps.has(userLanguage)) {
        userLanguage = langMaps.get(userLanguage) || '';
    }

    return userLanguage;
}
