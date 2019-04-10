import { Range, TextDocument, TextDocumentPositionParams, Position } from 'vscode-languageserver';
import { TextMateService, IGrammarExtensions, IToken } from './TextMateService';
import { isUpperCase, hasEndMark, isLowerCase } from '../util/string';
import { getNodeModule } from '../util/patch-asar-require';
import { Grammar } from './Grammar';

interface ICommentLine {
    line: number;
    startIndex?: number;
    endIndex?: number;
    fullLine?: boolean;
}

interface ICommentBlock {
    range: Range;
    comment: string;
}

type AstToken = IToken[][];

export interface ICommentOption {
    appRoot: string;
    grammarExtensions: IGrammarExtensions[];
    userLanguage: string;
}

export class TMGrammar {
    private _textMateService: TextMateService;
    private _commentBlockCaches: Map<string, ICommentBlock[]> = new Map();
    private _multiLineMerge: boolean = false;
    private _commentCache: Map<string, { commentLines: ICommentLine[], lines: string[] }> = new Map();
    private _textDocumentCache: Map<string, TextDocument> = new Map();
    public tm: any;
    constructor(option: ICommentOption) {
        this.tm = getNodeModule(option.appRoot, 'vscode-textmate')
        this._textMateService = new TextMateService(option.grammarExtensions, option.appRoot);
    }

    set multiLineMerge(newState: boolean) {
        if (this._multiLineMerge !== newState) {
            this._multiLineMerge = newState;
            this._commentBlockCaches.clear();
        }
    }

    deleteComment(uri: string) {
        this._commentBlockCaches.delete(uri);
        this._commentCache.delete(uri);
        this._textDocumentCache.delete(uri);
    }

    clearComment() {
        this._commentBlockCaches.clear();
        this._commentCache.clear();
        this._textDocumentCache.clear();
    }

    async parseDocument(textDocument: TextDocument): Promise<ICommentBlock[]> {
        let { commentLines, lines } = await this._parseLineComment(textDocument);
        let commentBlocks = this._parseComment(textDocument.uri, commentLines, lines);
        this._textDocumentCache.set(textDocument.uri, textDocument);
        return commentBlocks;
    }

    private async _parseLineComment(textDocument: TextDocument) {
        let lines = textDocument.getText().split('\n');
        let grammar = await this._textMateService.createGrammar(textDocument.languageId);
        let ruleStack = this.tm.INITIAL;

        let ast: AstToken = [];
        lines.forEach(line => {
            let r = grammar.tokenizeLine(line, ruleStack);
            ruleStack = r.ruleStack;
            ast.push(r.tokens);
        });

        function hasComment(scopes: string[]) {
            return scopes.findIndex(v => v.indexOf('comment') === 0) >= 0;
        }

        let commentLines: ICommentLine[] = [];
        for (let i = 0; i < ast.length; i += 1) {
            let lineComment: ICommentLine = { line: i };
            let j = ast[i].length - 1;
            for (; j >= 0; j -= 1) {
                let obj = ast[i][j];
                if (obj.startIndex >= lines[i].length - 1) continue;
                if (hasComment(obj.scopes)) {
                    lineComment.startIndex = obj.startIndex;
                    if (!lineComment.endIndex) lineComment.endIndex = obj.endIndex;
                } else {
                    break;
                }
            }
            if (lineComment.endIndex) {
                lineComment.fullLine = j <= 0;
                commentLines.push(lineComment);
            }
        }

        this._commentCache.set(textDocument.uri, {
            commentLines,
            lines
        });

        return {
            commentLines,
            lines
        };
    }

    private _mergeComment(oldComment: string, newLine: string): string {
        if (this._multiLineMerge) {
            let lastLine = oldComment.substring(oldComment.lastIndexOf('\n') + 1);
            lastLine = lastLine.replace(/^([\/\ \*])*/, '');
            let currentLine: string = newLine.replace(/^([\/\ \*])*/, '');
            if (isUpperCase(lastLine) && hasEndMark(lastLine) && isLowerCase(currentLine)) {
                return oldComment + ' ' + currentLine;
            }
        }


        return oldComment + '\n' + newLine;
    }

    private _parseComment(uri: string, commentLines: ICommentLine[], lines: string[]): ICommentBlock[] {
        let commentBlocks: ICommentBlock[] = [];
        commentLines.forEach(commentLine => {
            let lastBlock = commentBlocks.length - 1 >= 0 ? commentBlocks[commentBlocks.length - 1] : null;
            let block: ICommentBlock;
            if (lastBlock && commentLine.fullLine && lastBlock.range.end.line + 1 === commentLine.line) {
                block = lastBlock;
                block.comment = this._mergeComment(block.comment, lines[commentLine.line].trim());
                block.range.end = {
                    line: commentLine.line,
                    character: commentLine.endIndex
                }
            } else {
                block = {
                    range: Range.create({
                        line: commentLine.line,
                        character: commentLine.startIndex
                    },
                        {
                            line: commentLine.line,
                            character: commentLine.endIndex
                        }),
                    comment: lines[commentLine.line].slice(commentLine.startIndex, commentLine.endIndex).trim()
                };
                commentBlocks.push(block);
            }
        });
        this._commentBlockCaches.set(uri, commentBlocks);
        return commentBlocks;
    }

    public static containsPosition(range: Range, position: Position): boolean {
        if (position.line < range.start.line || position.line > range.end.line) {
            return false;
        }
        if (position.line === range.start.line && position.character < range.start.character) {
            return false;
        }
        if (position.line === range.end.line && position.character > range.end.character) {
            return false;
        }
        return true;
    }

    async getComment(position: TextDocumentPositionParams): Promise<ICommentBlock | null> {
        let commentBlocks: ICommentBlock[];
        let uri = position.textDocument.uri;
        if (!this._commentBlockCaches.has(uri)) {
            let { commentLines, lines } = await this._commentCache.get(uri);
            commentBlocks = await this._parseComment(uri, commentLines, lines);
        } else {
            commentBlocks = this._commentBlockCaches.get(uri);
        }
        let block = commentBlocks.find(block => {
            return TMGrammar.containsPosition(block.range, position.position);
        });

        return block;
    }

    async getTokenText(position: TextDocumentPositionParams): Promise<ICommentBlock | null> {
        let textDocument = this._textDocumentCache.get(position.textDocument.uri);
        if (!textDocument) return null;
        let grammar = await this._textMateService.createGrammar(textDocument.languageId);
        let g = new Grammar(textDocument);
        let res = g.compute(grammar, position.position);

        let range = Range.create({
            line: position.position.line,
            character: res.tokenStartIndex
        }, {
                line: position.position.line,
                character: res.tokenEndIndex
            });
        function isNeedTranslate(scope: string) {
            let arr = [
                'string.quoted',
                'entity',
                'variable',
                'support'
            ];

            return arr.some(item => {
                return scope.indexOf(item) === 0;
            });
        }

        if (res.scopes && isNeedTranslate(res.scopes[0])) {
            return {
                comment: res.tokenText,
                range: range
            }
        }

        return null;
    }
}