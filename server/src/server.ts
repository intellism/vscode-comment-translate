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
	DidChangeConfigurationNotification,
	Hover,
} from 'vscode-languageserver';

import { Comment } from './Comment';
import { patchAsarRequire } from './util/patch-asar-require';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);


// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let comment: Comment;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	comment = new Comment(params.initializationOptions, documents, connection);
	patchAsarRequire(params.initializationOptions.appRoot);
	comment.onTranslate((string) => {
		connection.console.log(string);
	});
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability =
		capabilities.workspace && !!capabilities.workspace.configuration;
	hasWorkspaceFolderCapability =
		capabilities.workspace && !!capabilities.workspace.workspaceFolders;

	return {
		capabilities: {
			hoverProvider: true,
			textDocumentSync: documents.syncKind,
		}
	};
});

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

	let setting = await connection.workspace.getConfiguration('commentTranslate');
	comment.setSetting(setting);
});
// The example settings
connection.onDidChangeConfiguration(async () => {
	let setting = await connection.workspace.getConfiguration('commentTranslate');
	comment.setSetting(setting);
});
// Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let last: Map<string, Hover> = new Map();
connection.onHover(async (textDocumentPosition) => {
	if (!comment) return null;
	let hover = await comment.getComment(textDocumentPosition);
	hover && last.set(textDocumentPosition.textDocument.uri, hover);
	return hover;
});

connection.onRequest('lastHover', ({ uri }) => {
	return last.get(uri);
});

connection.onRequest('translate', (text: string) => {
	if (!comment) return null;
	return comment.translate(text);
});

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
