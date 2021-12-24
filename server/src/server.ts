/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	DidChangeConfigurationNotification,
	TextDocumentPositionParams,
} from 'vscode-languageserver/node';
import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { Comment } from './Comment';
import { patchAsarRequire } from './util/patch-asar-require';
import { getHover, shortLive } from './service/hover';
import { Translator } from './translate/Translator';
import { ICommentBlock } from './syntax/CommentParse';


export async function getComment(textDocumentPosition: TextDocumentPositionParams): Promise<ICommentBlock | null> {
	if(!comment) return null;
	return comment.getComment(textDocumentPosition);
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
export let comment: Comment;
export let translator:Translator;

export interface ICommentTranslateSettings {
	multiLineMerge?: boolean;
	targetLanguage?: string;
	source: string;
	hover: {
		concise?: boolean;
		open: boolean;
		string: boolean;
		variable: boolean;
	}
}

let config: ICommentTranslateSettings = {
	multiLineMerge: false,
	source: 'Google',
	hover: {
		concise: false,
		open: true,
		string: false,
		variable: false
	}
};

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	config.targetLanguage = params.initializationOptions.userLanguage;
	comment = new Comment(params.initializationOptions, documents);
	translator = new Translator();
	translator.onTranslate((string) => {
		connection.console.log(string);
	});
	patchAsarRequire(params.initializationOptions.appRoot);
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	connection.console.log('in');

	return {
		capabilities: {
			definitionProvider: true,
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};
});

export function getConfig() {
	return config;
}

async function changeConfiguration() {
	let setting = await connection.workspace.getConfiguration('commentTranslate');
	config = setting;
}

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	await changeConfiguration();
});
connection.onRequest('translate', ({text,targetLanguage}:{text:string,targetLanguage:string}) => {
	if (!translator) return null;
	return translator.translate(text,{to:targetLanguage});
});
connection.onRequest('getHover', getHover);
connection.onRequest('getComment', getComment);
connection.onDefinition(async (definitionParams) => {
	shortLive.add(definitionParams);
	return null;
});
// The example settings
connection.onDidChangeConfiguration(changeConfiguration);

// Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });


// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
