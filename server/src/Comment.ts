import { TextDocumentPositionParams, Hover, Event, TextDocument } from "vscode-languageserver";
import { BaseTranslate } from "./translate/translate";
import { TMGrammar, ICommentOption } from "./syntax/CommentGrammar";
import { GoogleTranslate } from "./translate/GoogleTranslate";

export interface ICommentTranslateSettings {
    multiLineMerge: boolean;
    targetLanguage: string;
}

export class Comment {

    private _translator: BaseTranslate;
    private _grammar: TMGrammar;
    private _setting: ICommentTranslateSettings;
    public onTranslate: Event<string>;

    constructor(extensions: ICommentOption) {
        this._setting = { multiLineMerge: false, targetLanguage: extensions.userLanguage };
        this._grammar = new TMGrammar(extensions);
        this._translator = new GoogleTranslate();

        this.onTranslate = this._translator.onTranslate;
    }

    setSetting(newSetting: ICommentTranslateSettings) {
        this._setting = Object.assign(this._setting, newSetting);
        this._grammar.multiLineMerge = newSetting.multiLineMerge;
    }

    async parseDocument(textDocument: TextDocument) {
        return this._grammar.parseDocument(textDocument);
    }


    async getPositionTranslatedComment(textDocumentPosition: TextDocumentPositionParams): Promise<Hover> {
        let block = await this._grammar.getComment(textDocumentPosition);
        if (!block) return null;
        let targetLanguageComment = await this._translator.translate(block.comment, { to: this._setting.targetLanguage });

        return {
            contents: [`[Comment Translate] [Google](https://translate.google.cn/#auto/${this._setting.targetLanguage}/${encodeURIComponent(encodeURIComponent(block.comment))})`, "\r```typescript \n" + targetLanguageComment + " \n```"], range: block.range
        };
    }
}