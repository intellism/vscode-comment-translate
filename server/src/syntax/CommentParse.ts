import { TextDocument, Position, Range } from "vscode-languageserver";
import { IGrammar, StackElement, IToken, IGrammarExtensions } from "./TextMateService";
import { isUpperCase, hasEndMark, isLowerCase } from "../util/string";
export interface ITokenState {
    startState: StackElement | null;
    tokens1: IToken[];
    endState: StackElement | null;
}

export interface ICommentOption {
    appRoot: string;
    grammarExtensions: IGrammarExtensions[];
    userLanguage: string;
}

export interface ICommentBlock {
    humanize?: boolean;
    range: Range;
    comment: string;
}

export class CommentParse {
    private _model: string[];
    private _lines: ITokenState[] = [];

    constructor(textDocument: TextDocument, private _grammar: IGrammar, private _multiLineMerge: boolean = false) {
        this._model = textDocument.getText().split('\n');
    }

    //跨行元素合并
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

    private _parseTokensToLine(lineNumber: number): ITokenState[] {
        let state: StackElement | null = null;
        let lineLength = this._lines.length;
        if (lineLength) {
            state = this._lines[lineLength - 1].endState;
        }
        //重编译过的地方
        for (let i = lineLength; i <= lineNumber; i++) {
            let tokenizationResult = this._grammar.tokenizeLine(this._model[i], state);
            this._lines.push({
                startState: state,
                tokens1: tokenizationResult.tokens,
                endState: tokenizationResult.ruleStack
            });
            state = tokenizationResult.ruleStack;
        }

        return this._lines;
    }

    private _getTokensAtLine(lineNumber: number) {
        this._parseTokensToLine(lineNumber);
        return this._lines[lineNumber];
    }

    private _parseScopesText(tokens: IToken[], line: number, tokenIndex: number) {
        let tokenStartIndex = tokens[tokenIndex].startIndex;
        let tokenEndIndex = tokens[tokenIndex].endIndex;
        let tokenText = this._model[line].substring(tokenStartIndex, tokenEndIndex);

        let scopes: string[] = [];
        for (let i = tokens[tokenIndex].scopes.length - 1; i >= 0; i--) {
            scopes.push(escape(tokens[tokenIndex].scopes[i]))
        }

        return {
            tokenStartIndex,
            tokenEndIndex,
            tokenText,
            scopes
        }
    }

    public multiScope({ positionLine, dataTokens1, token1Index }: { dataTokens1: IToken[], token1Index: number, positionLine: number }, checkContentHandle: Function, maxLine: number, minLine: number, skipContentHandle?: (scope: string) => boolean) {

        let { tokenStartIndex, tokenEndIndex, tokenText } = this._parseScopesText(dataTokens1, positionLine, token1Index);

        let startLine = positionLine;
        let endLine = positionLine;
        //合并当前坐标之前的相连同类节点 before
        for (let line = positionLine, tokens1 = dataTokens1, tokenIndex = token1Index; line >= minLine;) {
            let index;
            for (index = tokenIndex - 1; index >= 0; index -= 1) {
                let res = this._parseScopesText(tokens1, line, index);
                if (skipContentHandle && skipContentHandle(res.scopes[0])) {
                    continue;
                }
                if (checkContentHandle(res.scopes[0])) {
                    tokenText = res.tokenText + tokenText;
                    tokenStartIndex = res.tokenStartIndex;
                    startLine = line;
                } else {
                    break;
                }
            }
            if (index >= 0) {
                break
            }
            line -= 1;
            if (line >= minLine) {
                let data1 = this._getTokensAtLine(line);
                tokens1 = data1.tokens1;
                tokenIndex = tokens1.length;
                tokenText = '\n' + tokenText;
            }
        }
        //合并当前坐标之后的相连同类节点 after
        for (let line = positionLine, tokens1 = dataTokens1, tokenIndex = token1Index; line <= maxLine;) {
            let index;
            for (index = tokenIndex + 1; index < tokens1.length; index += 1) {
                let res = this._parseScopesText(tokens1, line, index);
                if (skipContentHandle && skipContentHandle(res.scopes[0])) {
                    continue;
                }
                if (checkContentHandle(res.scopes[0])) {
                    tokenText = tokenText + res.tokenText;
                    tokenEndIndex = res.tokenEndIndex;
                    endLine = line;
                } else {
                    break;
                }
            }
            if (index < tokens1.length) {
                break
            }
            line += 1;
            if (line <= maxLine) {
                let data1 = this._getTokensAtLine(line);
                tokens1 = data1.tokens1;
                tokenIndex = -1;
                tokenText = tokenText + '\n';
            }
        }
        let newText = '';
        tokenText.split('\n').forEach(item => {
            newText = this._mergeComment(newText, item);
        });

        let range = Range.create({
            line: startLine,
            character: tokenStartIndex
        }, {
                line: endLine,
                character: tokenEndIndex
            });

        return {
            comment: newText,
            range: range
        }

    }

    public computeText(position: Position): ICommentBlock | null {
        function isCommentTranslate(scope: string) {
            //评论的token标记
            let arr = [
                'punctuation.definition.comment',
                'comment.block',
                'comment.line'
            ];

            return arr.some(item => {
                return scope.indexOf(item) === 0;
            });
        }

        function skipCommentTranslate(scope: string) {
            return scope.indexOf('punctuation.whitespace.comment') === 0;
        }

        function isStringTranslate(scope: string) {
            //字符串和转义字符的token标记
            let arr = [
                'string.quoted',
                'constant.character.escape'
            ];

            return arr.some(item => {
                return scope.indexOf(item) === 0;
            });
        }

        function isBaseTranslate(scope: string) {
            let arr = [
                'entity',
                'variable',
                'support',
                // Object表达式支持
                'meta.object-literal.key'
            ];

            return arr.some(item => {
                return scope.indexOf(item) === 0;
            });
        }

        let data = this._getTokensAtLine(position.line);
        let token1Index = 0;
        //定位起始位置标记
        for (let i = data.tokens1.length - 1; i >= 0; i--) {
            let t = data.tokens1[i];
            if (position.character - 1 >= t.startIndex) {
                token1Index = i;
                break;
            }
        }

        let { tokenStartIndex, tokenEndIndex, tokenText, scopes } = this._parseScopesText(data.tokens1, position.line, token1Index);
        //基础变量，只需要1个token
        if (scopes && isBaseTranslate(scopes[0])) {
            let range = Range.create({
                line: position.line,
                character: tokenStartIndex
            }, {
                    line: position.line,
                    character: tokenEndIndex
                });

            return {
                humanize: true,
                comment: tokenText,
                range: range
            }
        }

        //字符串中包含 \n 等， 需要在当前行，合并连续token
        if (scopes && isStringTranslate(scopes[0])) {
            return this.multiScope({
                positionLine: position.line,
                dataTokens1: data.tokens1,
                token1Index
            }, isStringTranslate, position.line, position.line);
        }

        //评论会跨越多行，需要在多行中合并连续评论token
        if (scopes && isCommentTranslate(scopes[0])) {
            return this.multiScope({
                positionLine: position.line,
                dataTokens1: data.tokens1,
                token1Index
            }, isCommentTranslate, this._model.length - 1, 0, skipCommentTranslate);
        }
        return null;
    }
}