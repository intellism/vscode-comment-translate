import { TextDocumentPositionParams, Hover, Event, TextDocuments, Connection } from "vscode-languageserver";
import { BaseTranslate } from "./translate/translate";
import { GoogleTranslate } from "./translate/GoogleTranslate";
import * as humanizeString from 'humanize-string';
import { CommentParse, ICommentOption, ICommentBlock } from "./syntax/CommentParse";
import { TextMateService } from "./syntax/TextMateService";

export interface ICommentTranslateSettings {
    multiLineMerge: boolean;
    targetLanguage: string;
}

export class Comment {

    private _translator: BaseTranslate;
    private _textMateService: TextMateService;
    private _setting: ICommentTranslateSettings;
    public onTranslate: Event<string>;

    constructor(extensions: ICommentOption, private _documents: TextDocuments, private _connection: Connection) {
        this._setting = { multiLineMerge: false, targetLanguage: extensions.userLanguage };
        this._translator = new GoogleTranslate();
        this.onTranslate = this._translator.onTranslate;
        this._textMateService = new TextMateService(extensions.grammarExtensions, extensions.appRoot);
    }

    setSetting(newSetting: ICommentTranslateSettings) {
        if (!newSetting.targetLanguage) {
            newSetting.targetLanguage = this._setting.targetLanguage;
        }
        this._setting = Object.assign(this._setting, newSetting);
    }

    async translate(text: string) {
        return await this._translator.translate(text, { to: this._setting.targetLanguage });
    }

    link(text: string) {
        return this._translator.link(text, { to: this._setting.targetLanguage });
    }

    private async _getSelectionContainPosition(textDocumentPosition: TextDocumentPositionParams): Promise<ICommentBlock> {
        let block = await this._connection.sendRequest<ICommentBlock>('selectionContains', textDocumentPosition);
        return block;
    }

    async getComment(textDocumentPosition: TextDocumentPositionParams): Promise<Hover> {
        let textDocument = this._documents.get(textDocumentPosition.textDocument.uri);
        if (!textDocument) return null;
        let grammar = await this._textMateService.createGrammar(textDocument.languageId);
        let parse: CommentParse = new CommentParse(textDocument, grammar, this._setting.multiLineMerge);

        //优先判断是hover坐标是否为选中区域。 优先翻译选择区域
        let block = await this._getSelectionContainPosition(textDocumentPosition);
        if (!block) {
            block = await parse.computeText(textDocumentPosition.position);
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