import { Disposable, ExtensionContext, Position, Range, TextDocument, workspace } from "vscode";
import { CommentParse } from "./CommentParse";
import { TextMateService } from "./TextMateService";
import { ICommentBlock } from "../interface";
import { getGrammerExtensions } from "../util/ext";
import { ctx } from "../extension";

export class Comment implements Disposable {

    private _disposable: Disposable;
    private _commentParseCache: Map<string, CommentParse> = new Map();
    constructor(private _textMateService: TextMateService) {
        // Close document or content changes, remove cache
        this._disposable = Disposable.from(
            workspace.onDidChangeTextDocument(e => this._removeCommentParse(e.document))
        );
    }

    dispose() {
        this._commentParseCache.clear();
        this._disposable?.dispose();
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
        if (grammar == null)
            return null;
        const parse = new CommentParse(textDocument, grammar);
        parse.maxLineLength = workspace.getConfiguration('editor').get('maxTokenizationLineLength', 20000) as number;
        this._commentParseCache.set(key, parse);
        return parse;
    }

    async getComment(textDocument: TextDocument, position: Position): Promise<ICommentBlock | null> {
        const parse = await this._getCommentParse(textDocument);
        if (!parse) return null;
        return parse.computeText(position);
    }

    async getAllComment(textDocument: TextDocument, type = 'comment', range?: Range): Promise<ICommentBlock[] | null> {
        const parse = await this._getCommentParse(textDocument);
        if (!parse) return null;
        return parse.computeAllText(type, range);
    }

    async getWordAtPosition(textDocument: TextDocument, position: Position) {
        const parse = await this._getCommentParse(textDocument);
        if (!parse) return null;
        return parse.getWordAtPosition(position);
    }

}

let comment: Comment;
export async function createComment() {
    if (comment) return comment;
    let grammarExtensions = await getGrammerExtensions();
    const textMate = new TextMateService(grammarExtensions);
    comment = new Comment(textMate);

    ctx.subscriptions.push(comment);
    return comment;
}
