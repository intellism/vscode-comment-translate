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
import { initTranslate } from './translate/manager';

export let outputChannel = window.createOutputChannel('Comment Translate');
export let comment: Comment;
let canLanguages: string[] = ['plaintext'];

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
    let translateManager = initTranslate(context, userLanguage);

    translateManager.onTranslate(e => {
        outputChannel.append(e);
    });


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





