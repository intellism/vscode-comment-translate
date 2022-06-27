/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

// import * as path from 'path';
import { ExtensionContext, extensions, env, window } from 'vscode';

// import {
//     LanguageClient,
//     LanguageClientOptions,
//     ServerOptions,
//     TransportKind,
// } from 'vscode-languageclient/node';
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
import { TextMateService } from './syntax/TextMateService';
// import { patchAsarRequire } from './util/patch-asar-require';

export let outputChannel = window.createOutputChannel('Comment Translate');
// export let client: LanguageClient;
export let comment: Comment;
let canLanguages: string[] = ['plaintext'];

export interface TokenTypesContribution {
    [scopeName: string]: string;
}
export interface IEmbeddedLanguagesMap {
    [scopeName: string]: string;
}

export interface ITMSyntaxExtensionPoint {
    language: string;
    scopeName: string;
    path: string;
    embeddedLanguages: IEmbeddedLanguagesMap;
    tokenTypes: TokenTypesContribution;
    injectTo: string[];
}
export interface ITMLanguageExtensionPoint {
    id: number;
    name: string;
}

export interface IGrammarExtensions {
    value: ITMSyntaxExtensionPoint[];
    extensionLocation: string;
    languages: ITMLanguageExtensionPoint[];
}
export let translateManager: TranslateManager;
export let translateExtensionProvider: TranslateExtensionProvider
export let userLanguage:string;

export async function activate(context: ExtensionContext) {
    // The server is implemented in node
    // let serverModule = context.asAbsolutePath(
    //     path.join('server', 'out', 'server.js')
    // );
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    // let debugOptions = { execArgv: ['--nolazy', '--inspect=16009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    // let serverOptions: ServerOptions = {
    //     run: { module: serverModule, transport: TransportKind.ipc },
    //     debug: {
    //         module: serverModule,
    //         transport: TransportKind.ipc,
    //         options: debugOptions
    //     }
    // };

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
        let lang = item.value.map((grammar) => grammar.language).filter(v => v);
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

    // Options to control the language client
    // let clientOptions: LanguageClientOptions = {
    //     // Register the server for plain text documents
    //     revealOutputChannelOn: 4,
    //     outputChannel: outputChannel,
    //     initializationOptions: {
    //         grammarExtensions, appRoot: env.appRoot
    //     },
    //     documentSelector: canLanguages,
    //     synchronize: {
    //         // Notify the server about file changes to '.clientrc files contained in the workspace
    //         // fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    //     }
    // };

    // Create the language client and start the client.
    // client = new LanguageClient(
    //     'CommentTranslate',
    //     'Comment Translate',
    //     serverOptions,
    //     clientOptions
    // );
    // // client.registerProposedFeatures();
    // // Start the client. This will also launch the server
    // client.start();

    // patchAsarRequire(env.appRoot); // 引入bug修复
    const textMate = new TextMateService(grammarExtensions);
    comment = new Comment(textMate);

    registerCommands(context);
    registerHover(context,canLanguages);
    registerDefinition(context,canLanguages);

    // 注册状态图标
    let hoverBar = await showHoverStatusBar();
    let targetBar = await showTargetLanguageStatusBarItem(userLanguage);
    context.subscriptions.push(targetBar, hoverBar, outputChannel,comment);
    //client准备就绪后再其他服务
    // await client.onReady();
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
    translateExtensionProvider.init(getConfig<string>('source') || '');
    // 暴露翻译插件
    return {
        extendTranslate: function (registry: ITranslateRegistry) {
            registry('ali.cloud', AliTranslate);
        }
    }
}

// export function deactivate(): Thenable<void> {
//     return client.stop();
// }
