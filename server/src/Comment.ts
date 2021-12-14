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
    constructor(extensions: ICommentOption, private _documents: TextDocuments<TextDocument>) {
        this._textMateService = new TextMateService(extensions.grammarExtensions, extensions.appRoot);
        //关闭文档或内容变更，移除缓存
        _documents.onDidClose(e => this._removeCommentParse(e.document));
        _documents.onDidChangeContent(e => this._removeCommentParse(e.document))
    }

    _removeCommentParse(textDocument: TextDocument) {
        let key = `${textDocument.languageId}-${textDocument.uri}`;
        this._commentParseCache.delete(key);
    }

    //缓存已匹配部分，加快hover运行时间
    async _getCommentParse(textDocument: TextDocument) {
        let key = `${textDocument.languageId}-${textDocument.uri}`;
        if (this._commentParseCache.has(key)) {
            return this._commentParseCache.get(key);
        }
        let grammar = await this._textMateService.createGrammar(textDocument.languageId);

        let {multiLineMerge} = getConfig();
        let parse: CommentParse = new CommentParse(textDocument, grammar, multiLineMerge);
        this._commentParseCache.set(key, parse);
        return parse;
    }

    async getComment(textDocumentPosition: TextDocumentPositionParams): Promise<ICommentBlock|null> {
        let textDocument = this._documents.get(textDocumentPosition.textDocument.uri);
        if (!textDocument) return null;
        let parse = await this._getCommentParse(textDocument);
        //优先判断是hover坐标是否为选中区域。 优先翻译选择区域
        let block:ICommentBlock|null = null;
        let {concise} = getConfig();
        if (parse) {
            block = await parse.computeText(textDocumentPosition.position, concise);
        }

        return block;
    }
}