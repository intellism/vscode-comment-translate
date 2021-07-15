/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import { workspace, ExtensionContext, extensions, env, commands, window, Selection, Position, Hover } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    TextDocumentPositionParams,
    Range
} from 'vscode-languageclient';
import { selectTargetLanguage, showTargetLanguageStatusBarItem } from './configuration';

let client: LanguageClient;

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
    let canLanguages: string[] = [];
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
    let userLanguage = env.language;

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        revealOutputChannelOn: 4,
        initializationOptions: {
            grammarExtensions, appRoot: env.appRoot, userLanguage
        },
        documentSelector: canLanguages.filter(v => v).filter((v) => BlackLanguage.indexOf(v) < 0),
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

    context.subscriptions.push(commands.registerCommand('commentTranslate.select', async () => {
        let editor = window.activeTextEditor;
        if (editor) {
            let hover = await client.sendRequest<Hover>('lastHover', { uri: editor.document.uri.toString() });
            if (!hover) return;
            editor.revealRange(hover.range);
            editor.selections = [new Selection(new Position(hover.range.start.line, hover.range.start.character), new Position(hover.range.end.line, hover.range.end.character)), ...editor.selections];
        }
    }));


    async function translateSelection(text: string, selection: Selection, targetLanguage:string) {
        let translation = await client.sendRequest<string>('translate', {text,targetLanguage});
        return { translation, selection };
    }

    //翻译选择区域并替换
    context.subscriptions.push(commands.registerCommand('commentTranslate.replaceSelections', async () => {
        let editor = window.activeTextEditor;
        if (!(editor && editor.document &&
            editor.selections.some(selection => !selection.isEmpty))) {
            return client.outputChannel.append(`No selection！\n`);
        }
        let targetLanguage = await selectTargetLanguage();
        let translates = editor.selections
            .filter(selection => !selection.isEmpty)
            .map(selection => {
                let text = editor.document.getText(selection);
                return translateSelection(text, selection, targetLanguage);
            });

        //添加装饰，提醒用户正在翻译中。 部分内容会原样返回，避免用户等待
        let decoration = window.createTextEditorDecorationType({
            color: '#FF2D00',
            backgroundColor: "transparent"
        });
        editor.setDecorations(decoration, editor.selections);
        let beginTime = Date.now();
        try {
            let results = await Promise.all(translates);
            //最少提示1秒钟
            setTimeout(() => {
                decoration.dispose();
            }, 1000 - (Date.now() - beginTime));
            editor.edit(builder => {
                results.forEach(item => {
                    item.translation && builder.replace(item.selection, item.translation);
                });
            });
        } catch (e) {
            decoration.dispose();
            client.outputChannel.append(e);
        }
    }));

    // 注册更改目标语言命令
    context.subscriptions.push(commands.registerCommand('commentTranslate.changeTargetLanguage', async function () {
        let configuration = workspace.getConfiguration('commentTranslate');
        let target = await selectTargetLanguage();
        if (target) {
            await configuration.update('targetLanguage', target);
        }
    }));
    // 注册状态图标
    let targetBar = await showTargetLanguageStatusBarItem(userLanguage);
    context.subscriptions.push(targetBar);

    //client准备就绪后再其他服务
    await client.onReady();
    interface ICommentBlock {
        humanize?: boolean;
        range: Range;
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
}

export function deactivate(): Thenable<void> {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
