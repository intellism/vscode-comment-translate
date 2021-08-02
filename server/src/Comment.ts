import { TextDocumentPositionParams, Hover, TextDocuments, Connection,Emitter } from "vscode-languageserver/node";
import { BaseTranslate, ITranslateOptions } from "./translate/translate";
import { GoogleTranslate } from "./translate/GoogleTranslate";
import { BingTranslate } from "./translate/BingTranslate";
import * as humanizeString from 'humanize-string';
import { CommentParse, ICommentOption, ICommentBlock } from "./syntax/CommentParse";
import { TextMateService } from "./syntax/TextMateService";
import { BaiduTranslate } from "./translate/BaiduTranslate";

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

export interface ICommentTranslateSettings {
    multiLineMerge: boolean;
    concise: boolean;
    targetLanguage: string;
    source:string;
}

export class Comment {

    private _translator: BaseTranslate = new GoogleTranslate();
    private _textMateService: TextMateService;
    private _setting: ICommentTranslateSettings;
    private _commentParseCache: Map<string, CommentParse> = new Map();
    protected _onTranslate = new Emitter<string>();
    constructor(extensions: ICommentOption, private _documents: TextDocuments<TextDocument>, private _connection: Connection) {
        this._setting = { multiLineMerge: false, targetLanguage: extensions.userLanguage,concise: false,source:'Google' };
        this._createTranslator();
        this._textMateService = new TextMateService(extensions.grammarExtensions, extensions.appRoot);
        //关闭文档或内容变更，移除缓存
        _documents.onDidClose(e => this._removeCommentParse(e.document));
        _documents.onDidChangeContent(e => this._removeCommentParse(e.document))
    }

    get onTranslate() {
        return this._onTranslate.event;
    }

    _createTranslator() {
        switch(this._setting.source) {
            case 'Bing':

            this._translator = new BingTranslate();
            break;

            case 'Baidu':

            this._translator = new BaiduTranslate();
            break;
            
            default:
            
            this._translator = new GoogleTranslate();
            break;
        }
        this._translator.onTranslate((str)=>this._onTranslate.fire(str));
    }

    setSetting(newSetting: ICommentTranslateSettings) {
        if (!newSetting.targetLanguage) {
            newSetting.targetLanguage = this._setting.targetLanguage;
        }
        this._setting = Object.assign(this._setting, newSetting);
        this._createTranslator();
    }

    async translate(text: string,opts?:ITranslateOptions) {
        return await this._translator.translate(text, opts||{ to: this._setting.targetLanguage });
    }

    link(text: string) {
        return this._translator.link(text, { to: this._setting.targetLanguage });
    }

    private async _getSelectionContainPosition(textDocumentPosition: TextDocumentPositionParams): Promise<ICommentBlock> {
        let block = await this._connection.sendRequest<ICommentBlock>('selectionContains', textDocumentPosition);
        return block;
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
        let parse: CommentParse = new CommentParse(textDocument, grammar, this._setting.multiLineMerge);
        this._commentParseCache.set(key, parse);
        return parse;
    }

    async getComment(textDocumentPosition: TextDocumentPositionParams): Promise<Hover|null> {
        let textDocument = this._documents.get(textDocumentPosition.textDocument.uri);
        if (!textDocument) return null;
        let parse = await this._getCommentParse(textDocument);
        //优先判断是hover坐标是否为选中区域。 优先翻译选择区域
        let block:ICommentBlock|null = await this._getSelectionContainPosition(textDocumentPosition);
        if (!block && parse) {
            block = await parse.computeText(textDocumentPosition.position, this._setting.concise);
        }
        if (block) {
            if (block.humanize) {
                //转换为可以自然语言分割
                let humanize = humanizeString(block.comment);
                let targetLanguageComment = await this.translate(humanize);
                return {
                    contents: [`[Comment Translate] ${this.link(humanize)}`, '\r \n' + humanize + ' => ' + targetLanguageComment], range: block.range
                };
            } else {
                let targetLanguageComment = await this.translate(block.comment);
                return {
                    contents: [`[Comment Translate] ${this.link(block.comment)}`, "\r```typescript \n" + targetLanguageComment + " \n```"],
                    range: block.range
                };
            }

        }
        return null;
    }
}