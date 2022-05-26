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
import { ICommentBlock } from './syntax/CommentParse';


export async function getComment(textDocumentPosition: TextDocumentPositionParams): Promise<ICommentBlock | null> {
	if(!comment) return null;
	return comment.getComment(textDocumentPosition);
}
export async function getAllComment({uri, type} :{uri: string, type:string}): Promise<ICommentBlock[] | null> {
	if(!comment) return null;
	return comment.getAllComment(uri,type);
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

	comment = new Comment(params.initializationOptions, documents);
	patchAsarRequire(params.initializationOptions.appRoot);
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	connection.console.log('Start comment translate server.');

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};
});

export function getConfig() {
	return config;
}

async function changeConfiguration() {
	config = await connection.workspace.getConfiguration('commentTranslate');
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

connection.onRequest('getComment', getComment);
connection.onRequest('getAllComment', getAllComment);
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
