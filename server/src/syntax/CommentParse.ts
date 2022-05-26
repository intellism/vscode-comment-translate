import { Position, Range } from "vscode-languageserver";
import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { IGrammar, StackElement, IToken, IGrammarExtensions } from "./TextMateService";
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
    range: Range;
    comment: string;
    tokens?: ICommentToken[];
}

export type checkScopeFunction = (scopes: string[]) => boolean;


function isComment(scopes: string[]) {
    //评论的token标记
    const arr = [
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

function isStringValue(scopes: string[]) {
    const scope = scopes[0];
    //字符串和转义字符的token标记
    const arr = [
        'string.interpolated',  // dart语言兼容
        'string.quoted',
        'constant.character.escape'
    ];

    return arr.some(item => {
        return scope.indexOf(item) === 0;
    });
}

function skipComment(scopes: string[]) {
    return isBlank(scopes) || (scopes[0].indexOf('punctuation.whitespace.comment') === 0);
}

function ignoreComment(scopes:string[]) {
    return scopes[0].indexOf('punctuation.definition.comment') === 0;
}

function isString(scopes: string[]) {
    const scope = scopes[0];
    //字符串和转义字符的token标记
    const arr = [
        'string.interpolated',  // dart语言兼容
        'string.quoted',
        'punctuation.definition.string',
        'constant.character.escape'
    ];

    return arr.some(item => {
        return scope.indexOf(item) === 0;
    });
}

function ignoreString(scopes: string[]) {
    return scopes[0].indexOf('punctuation.definition.string') === 0;
}

function isBlank(scopes:string[]) {
    return scopes[0].indexOf('source') === 0;
}

function isBase(scopes: string[]) {
    const scope = scopes[0];
    const arr = [
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

    constructor(textDocument: TextDocument, private _grammar: IGrammar) {
        this._model = textDocument.getText().split('\n');
    }

    private _parseTokensToLine(lineNumber: number): ITokenState[] {
        let state: StackElement | null = null;
        let lineLength = this._lines.length;
        if (lineLength) {
            state = this._lines[lineLength - 1].endState;
        }
        //重编译过的地方
        for (let i = lineLength; i <= lineNumber; i++) {
            const tokenizationResult = this._grammar.tokenizeLine(this._model[i], state);
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

    // 定位 position 起始位置标记
    private _posOffsetTokens(position:Position) {
        const {tokens1} = this._getTokensAtLine(position.line);
        let index = 0;
        for (let i = tokens1.length - 1; i >= 0; i--) {
            const {startIndex} = tokens1[i];
            if (position.character - 1 >= startIndex) {
                index = i;
                break;
            }
        }
        return index;
    }

    private _posScopesParse(line:number,index:number) {
        const {tokens1:tokens} = this._getTokensAtLine(line);
        const {startIndex, endIndex, scopes:prevScope} = tokens[index];
        const text = this._model[line].substring(startIndex, endIndex);
        const scopes = prevScope.reduce<string[]>((s,item)=>[item,...s],[]);

        return {
            startIndex,
            endIndex,
            text,
            scopes
        }
    }

    public commentScopeParse(position: Position, checkHandle: checkScopeFunction, single: boolean = false, opts?: { skipHandle?: checkScopeFunction,ignoreHandle?: checkScopeFunction }): ICommentBlock {
        const {skipHandle,ignoreHandle} = opts || {};
        const { line: originLine } = position;
        const index = this._posOffsetTokens(position);
        // 结果变量.
        let { startIndex, endIndex } = this._posScopesParse(originLine, index);
        let startLine = originLine;
        let endLine = originLine;        
        let tokens:ICommentToken[] = []; // TODO 初始化不对. 有些浪费
        for(let line = originLine;line>=0;line--) {
            let comment = '';
            let i = index;
            const scope:IScopeLen[] = [];
            if(line !== originLine) {
                const {tokens1} = this._getTokensAtLine(line);
                i = tokens1.length-1;
            }

            for(; i>=0; i--) {
                const { scopes, text, startIndex:si } = this._posScopesParse(line,i);
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

        for(let line = originLine;line<this._model.length;line++) {
            let comment = '';
            let i = 0;
            const scope:IScopeLen[] = [];
            const {tokens1} = this._getTokensAtLine(line);
            if(line === originLine) {
                i = index + 1;
            }
            for(; i<tokens1.length; i++) {
                const { scopes, text, endIndex:ei } = this._posScopesParse(line,i);
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

            if(line === originLine) {
                const current = tokens[tokens.length-1];
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

        // 标记定义符号位置
        if(ignoreHandle) {
            tokens = tokens.map(item=>{
                let {ignoreStart = 0,ignoreEnd = 0,scope} = item;
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
                return Object.assign(item,{ ignoreStart, ignoreEnd });
            });
        }

        const range = Range.create({
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

    public getAllText() : ICommentBlock[] | null {
        // 遍历所以注释
        let blocks = [];
        for( let line = 0; line < this._model.length; line+=1 ) {
            let {tokens1} = this._getTokensAtLine(line);
            for(let index = 0; index<tokens1.length; index +=1) {
                const { scopes,startIndex,endIndex,text } = this._posScopesParse(line,index);
                if (scopes && isStringValue(scopes)) {
                    const range = Range.create({
                        line,
                        character: startIndex
                    }, {
                            line,
                            character: endIndex
                        });
                    blocks.push( {
                        comment: text,
                        range: range
                    });
                }
            }
        }
        return blocks;
    }

    public getAllComment() : ICommentBlock[] | null {
        // 遍历所以注释
        let blocks = [];
        for( let line = 0; line < this._model.length; line+=1 ) {
            let {tokens1} = this._getTokensAtLine(line);
            for(let index = 0; index<tokens1.length; index +=1) {
                const { scopes,startIndex,endIndex,text } = this._posScopesParse(line,index);
                if (scopes && isComment(scopes)) {
                    let block = this.commentScopeParse(Position.create(line, startIndex+1),isComment,false,{
                        ignoreHandle:ignoreComment,skipHandle:skipComment
                    });
                    blocks.push(block);
                    line = block.range.end.line;
                    tokens1 = this._getTokensAtLine(line).tokens1;
                    index = this._posOffsetTokens(block.range.end);
                }
            }
        }
        return blocks;
    }

    public computeText(position: Position): ICommentBlock | null {
        const index = this._posOffsetTokens(position);
        const { scopes,startIndex,endIndex,text } = this._posScopesParse(position.line,index);
        const { hover:{string:stringHover,variable:variableHover} } = getConfig();
        if (scopes && isComment(scopes)) {
            return this.commentScopeParse(position,isComment,false,{
                ignoreHandle:ignoreComment,skipHandle:skipComment
            });
        }
        //字符串中包含 \n 等， 需要在当前行，合并连续token
        if (stringHover && scopes && isString(scopes)) {
            return this.commentScopeParse(position,isString,false,{ignoreHandle:ignoreString});
        }
        
        if (variableHover && scopes && isBase(scopes)) {
            const range = Range.create({
                line: position.line,
                character: startIndex
            }, {
                    line: position.line,
                    character: endIndex
                });

            return {
                comment: text,
                range: range
            }
        }

        return null;
    }
}