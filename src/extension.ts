/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { ExtensionContext, extensions, env, window } from 'vscode';
import { registerCommands } from './command/command';
import { mouseToSelect } from './command/select';
import { getConfig, onConfigChange, showHoverStatusBar, showTargetLanguageStatusBarItem } from './configuration';
import { registerDefinition } from './languageFeature/definition';
import { registerHover } from './languageFeature/hover';
import { AliTranslate } from './plugin/translateAli';
import { BingTranslate } from './translate/BingTranslate';
import { GoogleTranslate } from './translate/GoogleTranslate';
import { ITranslateConfig, ITranslateRegistry, TranslateExtensionProvider } from './translate/translateExtension';
import { ITranslateOptions, TranslateManager } from 'comment-translate-manager';
import { Comment } from './syntax/Comment';
import { TextMateService } from './syntax/TextMateService';
import { commentDecorationManager } from './languageFeature/decoration';
import { extractGrammarExtensions, readResources } from './util/ext';
import { detectLanguage } from './lang';
import { registerCompletion } from './languageFeature/completion';

export let outputChannel = window.createOutputChannel('Comment Translate');
export let comment: Comment;
let canLanguages: string[] = ['plaintext'];

export let translateManager: TranslateManager;
export let translateExtensionProvider: TranslateExtensionProvider
export let userLanguage: string;

export let ctx: ExtensionContext;

export async function activate(context: ExtensionContext) {
    ctx = context;

    // let languageId = 2;
    let { grammarExtensions, languageId } = extractGrammarExtensions([...extensions.all], 2);
    // 如果为远程环境，使用插件内置语法
    if (env.remoteName) {
        const inner = await readResources(context.extensionPath);
        let { grammarExtensions: innergrammarExtensions } = extractGrammarExtensions(inner, languageId);
        grammarExtensions.push(...innergrammarExtensions);
    }

    canLanguages = grammarExtensions.reduce<string[]>(((prev, item) => {
        let lang: string[] = item.value.map((grammar) => grammar.language).filter(v => v);
        return prev.concat(lang);
    }), canLanguages);


    let BlackLanguage: string[] = ['log', 'Log', 'code-runner-output'];
    canLanguages = canLanguages.filter((v) => BlackLanguage.indexOf(v) < 0);
    userLanguage = env.language;

    let langMaps: Map<string, string> = new Map([
        ['zh-cn', 'zh-CN'],
        ['zh-tw', 'zh-TW'],
    ]);
    // 修复语言代码不一致
    if (langMaps.has(userLanguage)) {
        userLanguage = langMaps.get(userLanguage) || '';
    }

    const textMate = new TextMateService(grammarExtensions);
    comment = new Comment(textMate);
    initTranslate(context);
    registerCommands(context);
    registerHover(context, canLanguages);
    registerDefinition(context, canLanguages);
    registerCompletion(context, canLanguages);

    context.subscriptions.push(...commentDecorationManager.showBrowseCommentTranslate(canLanguages));
    // 注册状态图标
    let hoverBar = await showHoverStatusBar();
    let targetBar = await showTargetLanguageStatusBarItem(userLanguage);
    context.subscriptions.push(targetBar, hoverBar, outputChannel, comment);
    mouseToSelect(context);

    // Exposing Translation Plugins
    return {
        extendTranslate: function (registry: ITranslateRegistry) {
            registry('ali.cloud', AliTranslate);
        }
    }
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



function initTranslate(context: ExtensionContext) {
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

    translateManager.onTranslate(e => {
        outputChannel.append(e);
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
    }];
    translateExtensionProvider = new TranslateExtensionProvider(translateManager, buildInTranslate);
    translateExtensionProvider.init(getConfig<string>('source', ''));
}
