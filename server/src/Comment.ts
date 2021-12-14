import { TextDocumentPositionParams, TextDocuments } from "vscode-languageserver/node";
import { CommentParse, ICommentOption, ICommentBlock } from "./syntax/CommentParse";
import { TextMateService } from "./syntax/TextMateService";
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { getConfig } from "./server";

export class Comment {

    private _textMateService: TextMateService;
    private _commentParseCache: Map<string, CommentParse> = new Map();
    constructor({ grammarExtensions, appRoot }: ICommentOption, private _documents: TextDocuments<TextDocument>) {
        this._textMateService = new TextMateService(grammarExtensions, appRoot);
        //关闭文档或内容变更，移除缓存
        _documents.onDidClose(e => this._removeCommentParse(e.document));
        _documents.onDidChangeContent(e => this._removeCommentParse(e.document))
    }

    _removeCommentParse({ languageId, uri }: TextDocument) {
        const key = `${languageId}-${uri}`;
        this._commentParseCache.delete(key);
    }

    //缓存已匹配部分，加快hover运行时间
    async _getCommentParse(textDocument: TextDocument) {
        const { uri, languageId } = textDocument;
        const key = `${languageId}-${uri}`;
        if (this._commentParseCache.has(key)) {
            return this._commentParseCache.get(key);
        }
        const grammar = await this._textMateService.createGrammar(languageId);

        const { multiLineMerge } = getConfig();
        const parse = new CommentParse(textDocument, grammar, multiLineMerge);
        this._commentParseCache.set(key, parse);
        return parse;
    }

    async getComment({ textDocument, position }: TextDocumentPositionParams): Promise<ICommentBlock | null> {
        const doc = this._documents.get(textDocument.uri);
        if (!doc) return null;
        const parse = await this._getCommentParse(doc);
        if (!parse) return null;
        const { concise } = getConfig();
        return await parse.computeText(position, concise);
    }
}