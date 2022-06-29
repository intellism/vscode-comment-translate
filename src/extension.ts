/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { ExtensionContext, extensions, env, window } from 'vscode';
import { registerCommands } from './command/command';
import { mouseToSelect } from './command/select';
import { getConfig, showHoverStatusBar, showTargetLanguageStatusBarItem } from './configuration';
import { registerDefinition } from './languageFeature/definition';
import { registerHover } from './languageFeature/hover';
import { AliTranslate } from './plugin/translateAli';
import { BaiduTranslate } from './translate/baiduTranslate';
import { BingTranslate } from './translate/bingTranslate';
import { GoogleTranslate } from './translate/googleTranslate';
import { ITranslateConfig, ITranslateRegistry, TranslateExtensionProvider } from './translate/translateExtension';
import { TranslateManager } from 'comment-translate-manager';
import { Comment } from './syntax/Comment';
import { IGrammarExtensions, ITMLanguageExtensionPoint, TextMateService } from './syntax/TextMateService';

export let outputChannel = window.createOutputChannel('Comment Translate');
export let comment: Comment;
let canLanguages: string[] = ['plaintext'];

export let translateManager: TranslateManager;
export let translateExtensionProvider: TranslateExtensionProvider
export let userLanguage:string;

export async function activate(context: ExtensionContext) {

    let languageId = 2;
    let grammarExtensions: IGrammarExtensions[] = extensions.all.filter(({ packageJSON }) => {
        return packageJSON.contributes && packageJSON.contributes.grammars;
    }).map(({ packageJSON, extensionPath }) => {
        const contributesLanguages = packageJSON.contributes.languages || [];
        const languages: ITMLanguageExtensionPoint[] = contributesLanguages.map((item: any) => {
            return {
                id: languageId++,
                name: item.id
            }
        });
        return {
            languages,
            value: packageJSON.contributes.grammars,
            extensionLocation: extensionPath
        }
    });

    canLanguages = grammarExtensions.reduce<string[]>(((prev, item) => {
        let lang:string[] = item.value.map((grammar) => grammar.language).filter(v => v);
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

    registerCommands(context);
    registerHover(context,canLanguages);
    registerDefinition(context,canLanguages);
    // 注册状态图标
    let hoverBar = await showHoverStatusBar();
    let targetBar = await showTargetLanguageStatusBarItem(userLanguage);
    context.subscriptions.push(targetBar, hoverBar, outputChannel,comment);
    mouseToSelect(context);

    // 最多单次可以翻译10000字符。 内部会分拆请求翻译服务。
    translateManager = new TranslateManager(context.workspaceState, 10000);
    translateManager.onTranslate(e => {
        outputChannel.append(e);
    });

    const buildInTranslate:ITranslateConfig[] = [{
        title: 'Google translate',
        ctor: GoogleTranslate,
        translate: 'Google'
    },
    {
        title: 'Baidu translate',
        ctor: BaiduTranslate,
        translate: 'Baidu'
    },
    {
        title: 'Bing translate',
        ctor: BingTranslate,
        translate: 'Bing'
    }];
    translateExtensionProvider = new TranslateExtensionProvider(translateManager, buildInTranslate);
    translateExtensionProvider.init(getConfig<string>('source',''));
    // 暴露翻译插件
    return {
        extendTranslate: function (registry: ITranslateRegistry) {
            registry('ali.cloud', AliTranslate);
        }
    }
}
