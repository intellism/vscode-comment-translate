/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import { workspace, ExtensionContext, extensions, env, commands, window, Selection, Position, Hover, TextEditorSelectionChangeKind, languages, MarkdownString, Range } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    TextDocumentPositionParams,
    Range as RangeL
} from 'vscode-languageclient/node';
import { registerCommands } from './command/command';
import { selectTargetLanguage, showTargetLanguageStatusBarItem } from './configuration';
import { registerHover } from './languageFeature/hover';

export let client: LanguageClient;
let canLanguages: string[] = [];

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

export async function activate(context: ExtensionContext) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    let debugOptions = { execArgv: ['--nolazy', '--inspect=16009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    let extAll = extensions.all;
    let languageId = 2;
    let grammarExtensions: IGrammarExtensions[] = [];
    
    extAll.forEach(extension => {
        if (!(extension.packageJSON.contributes && extension.packageJSON.contributes.grammars)) return;
        let languages: ITMLanguageExtensionPoint[] = [];
        (extension.packageJSON.contributes && extension.packageJSON.contributes.languages || []).forEach((language: any) => {
            languages.push({
                id: languageId++,
                name: language.id
            });
        })
        grammarExtensions.push({
            languages: languages,
            value: extension.packageJSON.contributes && extension.packageJSON.contributes.grammars,
            extensionLocation: extension.extensionPath
        });
        canLanguages = canLanguages.concat(extension.packageJSON.contributes.grammars.map((g: any) => g.language));
    });
    let BlackLanguage: string[] = ['log', 'Log'];
    canLanguages = canLanguages.filter(v => v).filter((v) => BlackLanguage.indexOf(v) < 0);
    let userLanguage = env.language;

    let langMaps:Map<string,string> = new Map([
        ['zh-cn','zh-CN'],
        ['zh-tw','zh-TW'],
    ]);
    // 修复语言代码不一致
    if(langMaps.has(userLanguage)) {
        userLanguage = langMaps.get(userLanguage);
    }

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        revealOutputChannelOn: 4,
        initializationOptions: {
            grammarExtensions, appRoot: env.appRoot, userLanguage
        },
        documentSelector: canLanguages,
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            // fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'CommentTranslate',
        'Comment Translate',
        serverOptions,
        clientOptions
    );
    // client.registerProposedFeatures();
    // Start the client. This will also launch the server
    client.start();

    registerCommands(context);
    registerHover(canLanguages);

    // 注册状态图标
    let targetBar = await showTargetLanguageStatusBarItem(userLanguage);
    context.subscriptions.push(targetBar);

    //client准备就绪后再其他服务
    await client.onReady();
    interface ICommentBlock {
        humanize?: boolean;
        range: RangeL;
        comment: string;
    }
    //提供选择检查服务
    client.onRequest<ICommentBlock, TextDocumentPositionParams>('selectionContains', (textDocumentPosition: TextDocumentPositionParams) => {
        let editor = window.activeTextEditor;
        //有活动editor，并且打开文档与请求文档一致时处理请求
        if (editor && editor.document.uri.toString() === textDocumentPosition.textDocument.uri) {
            //类型转换
            let position = new Position(textDocumentPosition.position.line, textDocumentPosition.position.character);
            let selection = editor.selections.find((selection) => {
                return !selection.isEmpty && selection.contains(position);
            });

            if (selection) {
                return {
                    range: selection,
                    comment: editor.document.getText(selection)
                };
            }
        }

        return null;
    });
    let lastShowHover: number;
    let showHoverTimer:NodeJS.Timeout;
    context.subscriptions.push(window.onDidChangeTextEditorSelection((e)=>{
        // 只支持划词翻译
        if(e.kind !== TextEditorSelectionChangeKind.Mouse) return;
        if(e.selections.filter(selection => !selection.isEmpty).length === 0) return;
        let laterTime = 300;
        if(lastShowHover) {
            let gap = (new Date()).getTime() - lastShowHover;
            laterTime = Math.max(600-gap, 300);
        }
        clearTimeout(showHoverTimer);
        showHoverTimer = setTimeout(()=>{
            commands.executeCommand('editor.action.showHover');
            lastShowHover = (new Date()).getTime();
        },laterTime);
    }));
}

export function deactivate(): Thenable<void> {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
