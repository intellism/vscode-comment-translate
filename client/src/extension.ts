/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import { ExtensionContext, extensions, env } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient';

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
    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        initializationOptions: {
            grammarExtensions, appRoot: env.appRoot
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
}

export function deactivate(): Thenable<void> {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
