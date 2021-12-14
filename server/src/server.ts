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
	Hover,
	TextDocumentPositionParams,
} from 'vscode-languageserver/node';
import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { Comment } from './Comment';
import { patchAsarRequire } from './util/patch-asar-require';
import { ShortLive } from './util/short-live';
import humanizeString = require('humanize-string');
import { ICommentBlock } from './syntax/CommentParse';
import { TranslateCreator } from './translate/Translator';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let comment: Comment;
let translator: TranslateCreator;
export interface ICommentTranslateSettings {
    multiLineMerge?: boolean;
    concise?: boolean;
    targetLanguage?: string;
    source:string;
}

let config: ICommentTranslateSettings = {
	multiLineMerge: false,concise: false,source:'Google'
};

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	config.targetLanguage = params.initializationOptions.userLanguage;
	comment = new Comment(params.initializationOptions, documents);
	translator = new TranslateCreator();

	patchAsarRequire(params.initializationOptions.appRoot);
	translator.onTranslate((string) => {
		connection.console.log(string);
	});
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

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
// The example settings
connection.onDidChangeConfiguration(changeConfiguration);

// Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });

let shortLive = new ShortLive((item: TextDocumentPositionParams, data: TextDocumentPositionParams) => {
	if (item.textDocument.uri === data.textDocument.uri) {
		return true;
	}
	return false;
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let last: Map<string, Hover> = new Map();

connection.onDefinition(async (definitionParams) => {
	shortLive.add(definitionParams);

	return null;
});

connection.onRequest('lastHover', ({ uri }) => {
	return last.get(uri);
});

connection.onRequest('translate', ({text,targetLanguage}:{text:string,targetLanguage:string}) => {
	if (!translator) return null;
	return translator.translate(text,{to:targetLanguage});
});

// 迁移hover到手动触发
connection.onRequest('getHover', async (textDocumentPosition:TextDocumentPositionParams) => {
	
	let {concise} = getConfig();

	if (!comment) return null;
	if (concise && !shortLive.isLive(textDocumentPosition)) return null;
	
	let hover;

	let block:ICommentBlock|null = await connection.sendRequest<ICommentBlock>('selectionContains', textDocumentPosition);
	if(!block) {
		block = await comment.getComment(textDocumentPosition);
	}
	if (block) {
		if (block.humanize) {
			//转换为可以自然语言分割
			let humanize = humanizeString(block.comment);
			let targetLanguageComment = await translator.translate(humanize);
			hover = {
				contents: [`[Comment Translate $(globe)] ${translator.link(humanize)}`, '\r \n' + humanize + ' => ' + targetLanguageComment], range: block.range
			};
		} else {
			let targetLanguageComment = await translator.translate(block.comment);
			hover = {
				contents: [`[Comment Translate $(globe)] ${translator.link(block.comment)}`, "\r```typescript \n" + targetLanguageComment + " \n```"],
				range: block.range
			};
		}
	}

	hover && last.set(textDocumentPosition.textDocument.uri, hover);
	return hover;
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
