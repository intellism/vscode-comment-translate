/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { ExtensionContext, window, workspace } from 'vscode';
import { registerCommands } from './command/command';
// import { mouseToSelect } from './command/select';
import { showHoverStatusBar, showTargetLanguageStatusBarItem } from './configuration';
import { registerDefinition } from './languageFeature/definition';
import { registerHover } from './languageFeature/hover';
import { AliTranslate } from './plugin/translateAli';
import { ITranslateRegistry } from 'comment-translate-manager';
import { createComment } from './syntax/Comment';
import { commentDecorationManager } from './languageFeature/decoration';
import { getCanLanguageIds } from './util/ext';
import { registerCompletion } from './languageFeature/completion';
import { getUserLanguage, initTranslate } from './translate/manager';
import { registerChatParticipant } from './copilot/translate';
import { cleanupVariableCompletionByUri } from './command/replaceSelections';

export let outputChannel = window.createOutputChannel('Comment Translate');


export let ctx: ExtensionContext;

export async function activate(context: ExtensionContext) {
    ctx = context;

    // Languages capable of parsing comments via TextMate
    let canLanguages: string[] = await getCanLanguageIds();
    let translateManager = initTranslate(context);
    translateManager.onTranslate(e => {
        outputChannel.append(e);
    });

    createComment();
    registerCommands(context);
    registerHover(context, canLanguages);
    registerDefinition(context, canLanguages);
    registerCompletion(context, canLanguages);
    registerChatParticipant(context);

    context.subscriptions.push(...commentDecorationManager.showBrowseCommentTranslate(canLanguages));
    context.subscriptions.push(workspace.onDidCloseTextDocument((doc) => {
        cleanupVariableCompletionByUri(doc.uri.toString());
    }));
    // 注册状态图标
    let hoverBar = await showHoverStatusBar();

    let userLanguage = getUserLanguage();
    let targetBar = await showTargetLanguageStatusBarItem(userLanguage);
    context.subscriptions.push(targetBar, hoverBar, outputChannel);
    // mouseToSelect(context);

    // Exposing Translation Plugins
    return {
        extendTranslate: function (registry: ITranslateRegistry) {
            registry('ali.cloud', AliTranslate);
        }
    }
}



