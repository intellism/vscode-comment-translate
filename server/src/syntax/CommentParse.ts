import { TextDocument, Position, Range } from "vscode-languageserver";
import { IGrammar, StackElement, IToken, IGrammarExtensions } from "./TextMateService";
import { isUpperCase, hasEndMark, isLowerCase } from "../util/string";
import { getConfig } from "../server";
export interface ITokenState {
    startState: StackElement | null;
    tokens1: IToken[];
    endState: StackElement | null;
}

interface IScopeLen{
    scopes:string[];
    len:number;
}

interface ICommentToken {
    ignoreStart?:number;
    ignoreEnd?:number;
    text:string;
    scope:IScopeLen[];
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
    tokens?: ICommentToken[];
}

export type checkScopeFunction = (scopes: string[]) => boolean;


function isCommentTranslate(scopes: string[]) {
    //评论的token标记
    let arr = [
        'punctuation.definition.comment',
        'comment.block',
        'comment.line'
    ];

    return scopes.some(scope => {
        return arr.some(item => {
            return scope.indexOf(item) === 0;
        });
    })
}

function skipCommentTranslate(scope: string) {
    return scope.indexOf('punctuation.whitespace.comment') === 0;
}

function ignoreCommentTranslate(scopes:string[]) {
    return scopes[0].indexOf('punctuation.definition.comment') === 0;
}

function isStringTranslate(scopes: string[]) {
    let scope = scopes[0];
    //字符串和转义字符的token标记
    let arr = [
        'string.quoted',
        'punctuation.definition.string',
        'constant.character.escape'
    ];

    return arr.some(item => {
        return scope.indexOf(item) === 0;
    });
}

function ignoreStringTranslate(scopes: string[]) {
    return scopes[0].indexOf('punctuation.definition.string') === 0;
}

function isBaseTranslate(scopes: string[]) {
    let scope = scopes[0];
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

    public multiScope({ line, tokens, index }: { tokens: IToken[], index: number, line: number }, checkContentHandle: checkScopeFunction, maxLine: number, minLine: number, skipContentHandle?: (scope: string) => boolean) {

        let { tokenStartIndex, tokenEndIndex, tokenText } = this._parseScopesText(tokens, line, index);

        let startLine = line;
        let endLine = line;
        //合并当前坐标之前的相连同类节点 before
        for (let currentLine = line, tokens1 = tokens, tokenIndex = index; currentLine >= minLine;) {
            let index;
            for (index = tokenIndex - 1; index >= 0; index -= 1) {
                let res = this._parseScopesText(tokens1, currentLine, index);
                if (skipContentHandle && skipContentHandle(res.scopes[0])) {
                    continue;
                }
                if (checkContentHandle(res.scopes)) {
                    tokenText = res.tokenText + tokenText;
                    tokenStartIndex = res.tokenStartIndex;
                    startLine = currentLine;
                } else {
                    break;
                }
            }
            if (index >= 0) {
                break
            }
            currentLine -= 1;
            if (currentLine >= minLine) {
                let data1 = this._getTokensAtLine(currentLine);
                tokens1 = data1.tokens1;
                tokenIndex = tokens1.length;
                tokenText = '\n' + tokenText;
            }
        }
        //合并当前坐标之后的相连同类节点 after
        for (let currentLine = line, tokens1 = tokens, tokenIndex = index; currentLine <= maxLine;) {
            let index;
            for (index = tokenIndex + 1; index < tokens1.length; index += 1) {
                let res = this._parseScopesText(tokens1, currentLine, index);
                if (skipContentHandle && skipContentHandle(res.scopes[0])) {
                    continue;
                }
                if (checkContentHandle(res.scopes)) {
                    tokenText = tokenText + res.tokenText;
                    tokenEndIndex = res.tokenEndIndex;
                    endLine = currentLine;
                } else {
                    break;
                }
            }
            if (index < tokens1.length) {
                break
            }
            currentLine += 1;
            if (currentLine <= maxLine) {
                let data1 = this._getTokensAtLine(currentLine);
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
    
    // 定位 position 起始位置标记
    private _posOffsetTokens(position:Position) {
        let {tokens1} = this._getTokensAtLine(position.line);
        let index = 0;
        for (let i = tokens1.length - 1; i >= 0; i--) {
            let t = tokens1[i];
            if (position.character - 1 >= t.startIndex) {
                index = i;
                break;
            }
        }
        return index;
    }

    private _posScopesParse(line:number,index:number) {
        let {tokens1:tokens} = this._getTokensAtLine(line);
        let {startIndex, endIndex, scopes} = tokens[index];
        let text = this._model[line].substring(startIndex, endIndex);
        scopes = scopes.reduce<string[]>((s,item)=>[item,...s],[]);

        return {
            startIndex,
            endIndex,
            text,
            scopes
        }
    }

    public commentScopeParse(position: Position, checkHandle: checkScopeFunction, single: boolean = false, opts?: { skipHandle?: checkScopeFunction,ignoreHandle?: checkScopeFunction }): ICommentBlock {
        const {skipHandle,ignoreHandle} = opts || {};
        const { line: prevLine } = position;
        const index = this._posOffsetTokens(position);
        // 结果变量.
        let { startIndex, endIndex } = this._posScopesParse(prevLine, index);
        let startLine = prevLine;
        let endLine = prevLine;        
        let tokens:ICommentToken[] = []; // TODO 初始化不对. 有些浪费
        for(let line = prevLine;line>=0;line--) {
            let comment = '';
            let i = index;
            let scope:IScopeLen[] = [];
            if(line !== prevLine) {
                const {tokens1} = this._getTokensAtLine(line);
                i = tokens1.length-1;
            }

            for(; i>=0; i--) {
                let { scopes, text, startIndex:si } = this._posScopesParse(line,i);
                if (skipHandle && skipHandle(scopes)) {
                    continue;
                }
                if (checkHandle(scopes)) {
                    comment = text + comment;
                    startIndex = si;
                    startLine = line;
                    scope.unshift({
                        scopes,
                        len:text.length
                    });
                } else {
                    break;
                }
            }
            comment&&tokens.unshift({
                text:comment,
                scope
            });

            if (i >= 0 || single) break;
        }

        for(let line = prevLine;line<this._model.length;line++) {
            let comment = '';
            let i = 0;
            let scope:IScopeLen[] = [];
            const {tokens1} = this._getTokensAtLine(line);
            if(line === prevLine) {
                i = index + 1;
            }
            for(; i<tokens1.length; i++) {
                let { scopes, text, endIndex:ei } = this._posScopesParse(line,i);
                if (skipHandle && skipHandle(scopes)) {
                    continue;
                }
                if (checkHandle(scopes)) {
                    comment = comment + text;
                    endIndex = ei;
                    endLine = line;
                    scope.push({scopes,len:text.length});
                } else {
                    break;
                }
            }

            if(line === prevLine) {
                let current = tokens[tokens.length-1];
                current.text = current.text+comment;
                current.scope = current.scope.concat(scope);
            } else {
                comment&&tokens.push({
                    text:comment,
                    scope
                });
            }
            if (i < tokens1.length || single) break;
        }
        if(ignoreHandle) {
            tokens = tokens.map(item=>{
                let {scope} = item;
                let ignoreStart = 0;
                let ignoreEnd = 0;
                let j;
                for(j=0;j<scope.length;j++) {
                    if(ignoreHandle(scope[j].scopes)) {
                        ignoreStart += scope[j].len;
                    } else {
                        break;
                    }
                }

                for(let i=scope.length-1;i>j;i--) {
                    if(ignoreHandle(scope[i].scopes)) {
                        ignoreEnd += scope[i].len;
                    } else {
                        break;
                    }
                }
                return Object.assign({ ignoreStart, ignoreEnd },item);
            });
        }

        let range = Range.create({
            line: startLine,
            character: startIndex
        }, {
            line: endLine,
            character: endIndex
        });

        return {
            comment: tokens.map(((item)=>{
                return item.text;
            })).join('\n'),
            range,
            tokens
        }
    }

    public computeText1(position: Position): ICommentBlock | null {
        const index = this._posOffsetTokens(position);
        let { scopes,startIndex,endIndex,text } = this._posScopesParse(position.line,index);
        let { hover:{string:stringHover,variable:variableHover} } = getConfig();
        if (scopes && isCommentTranslate(scopes)) {
            return this.commentScopeParse(position,isCommentTranslate,false,{
                ignoreHandle:ignoreCommentTranslate,skipHandle:(scopes=>{return skipCommentTranslate(scopes[0])})
            });
        }
        //字符串中包含 \n 等， 需要在当前行，合并连续token
        if (stringHover && scopes && isStringTranslate(scopes)) {
            return this.commentScopeParse(position,isStringTranslate,true,{ignoreHandle:ignoreStringTranslate});
        }
        
        if (variableHover && scopes && isBaseTranslate(scopes)) {
            let range = Range.create({
                line: position.line,
                character: startIndex
            }, {
                    line: position.line,
                    character: endIndex
                });

            return {
                humanize: true,
                comment: text,
                range: range
            }
        }

        return null;
    }


    public computeText(position: Position, fullToken = false): ICommentBlock | null {
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
        //字符串中包含 \n 等， 需要在当前行，合并连续token
        if (scopes && isStringTranslate(scopes)) {
            return this.multiScope({
                line: position.line,
                tokens: data.tokens1,
                index:token1Index
            }, isStringTranslate, position.line, position.line);
        }

        //评论会跨越多行，需要在多行中合并连续评论token
        if (scopes && isCommentTranslate(scopes)) {
            // return this.commentScopeParse(position,isCommentTranslate,false,{
            //     ignoreHandle:ignoreCommentTranslate,skipHandle:(scopes=>{return skipCommentTranslate(scopes[0])})
            // });
            return this.multiScope({
                line: position.line,
                tokens: data.tokens1,
                index:token1Index
            }, isCommentTranslate, this._model.length - 1, 0, skipCommentTranslate);
        }

        //基础变量，只需要1个token
        if (scopes && (fullToken || isBaseTranslate(scopes))) {
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

        return null;
    }
}