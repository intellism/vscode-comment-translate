import { Position, Range, TextDocument } from "vscode";
import { IGrammar, StackElement } from "./TextMateService";
import { getConfig } from "../configuration";
import { checkScopeFunction, ICommentBlock, ICommentToken, ITokenState } from "../interface";

function findLeadingWhitespaceOrUnpairedIndex(str: string): number {
    const unpairedSymbols = new Set(['*', '+', '-', '#', '?', '!', '|', '&', '~','^',',','.',':',';']);
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (!char.match(/\s/) && !unpairedSymbols.has(char)) {
            return i;
        }
    }
    return str.length;
}

export function isComment(scopes: string[]) {
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

export function skipComment(scopes: string[]) {
    return isBlank(scopes) || (scopes[0].indexOf('punctuation.whitespace.comment') === 0);
    // return (scopes[0].indexOf('punctuation.whitespace.comment') === 0);
}

export function ignoreComment(scopes: string[]) {
    if(scopes[0].indexOf('.jsdoc') >= 0) return true;

    return scopes[0].indexOf('punctuation.definition.comment') === 0;
}

function isString(scopes: string[]) {
    const scope = scopes[0];
    //字符串和转义字符的token标记
    const arr = [
        'string.unquoted', // ymal等，无引号String
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

function isBlank(scopes: string[]) {
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
    public maxLineLength = 20000;

    constructor(private _textDocument: TextDocument, private _grammar: IGrammar) {
        this._model = _textDocument.getText().split('\n');
    }

    private _parseTokensToLine(lineNumber: number): ITokenState[] {
        let state: StackElement | null = null;
        let lineLength = this._lines.length;
        if (lineLength) {
            state = this._lines[lineLength - 1].endState;
        }
        //重编译过的地方
        for (let i = lineLength; i <= lineNumber; i++) {

            if (this._model[i].length > this.maxLineLength) {
                throw new Error(`Single-line text exceeds the limit of ${this.maxLineLength} characters`);
            }

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

    /**
     * 定位 position 的Token起始位置标记
     * @param position 给定坐标
     * @returns 
     */
    // private _posOffsetTokens(position: Position) {
    //     const { tokens1 } = this._getTokensAtLine(position.line);

    //     for (let index = 0; index < tokens1.length; index++) {
    //         const range = tokens1[index];
    //         if (position.character >= range.startIndex && position.character <= range.endIndex) {
    //             return index;
    //         }
    //     }
    //     return -1;
    // }

    private _posOffsetTokens(position: Position) {
        const { tokens1 } = this._getTokensAtLine(position.line);
        let index = -1;
        for (let i = tokens1.length - 1; i >= 0; i--) {
            const { startIndex } = tokens1[i];
            if (position.character >= startIndex) {
                index = i;
                break;
            }
        }
        return index;
    }

    /**
     * 解析标记行中给定位置的Token内容
     *
     * @param {number} line - The line number to parse.
     * @param {number} index - The token index to parse.
     * @return {{startIndex: number, endIndex: number, text: string, scopes: string[]}} 
     *         An object containing the start index, end index, text, and scopes of the token.
     */
    private _posScopesParse(line: number, index: number) {
        const { tokens1: tokens } = this._getTokensAtLine(line);
        const { startIndex, endIndex, scopes: prevScope } = tokens[index];
        const text = this._model[line].substring(startIndex, endIndex);
        const scopes = prevScope.reduce<string[]>((s, item) => [item, ...s], []);

        return {
            startIndex,
            endIndex,
            text,
            scopes
        }
    }



    public commentScopeParse(position: Position, checkHandle: checkScopeFunction, single: boolean = false, opts?: { skipHandle?: checkScopeFunction, ignoreHandle?: checkScopeFunction }): ICommentBlock {
        const { skipHandle } = opts || {};
        const { line: originLine } = position;
        const index = this._posOffsetTokens(position);
        // 结果变量.
        let { startIndex, endIndex } = this._posScopesParse(originLine, index);
        let startLine = originLine;
        let endLine = originLine;

        // 分析注释的起始位置
        let skipEnable = false;
        for (let line = originLine; line >= 0; line--,skipEnable = false) {
            let i = index;
            if (line !== originLine) {
                const { tokens1 } = this._getTokensAtLine(line);
                i = tokens1.length - 1;
                // 空白行，如同skipHandle
            }
            for (; i >= 0; i--) {
                const { scopes, startIndex: si } = this._posScopesParse(line, i);
                
                if (checkHandle(scopes)) {
                    startIndex = si;
                    startLine = line;
                    skipEnable = true;
                } else if(skipEnable && skipHandle && skipHandle(scopes)) {
                    skipEnable = false;
                    continue;
                } else {
                    break;
                }
            }
            if (i >= 0 || single ) break;
        }

        // 分析注释的结束位置
        skipEnable = true;
        for (let line = originLine; line < this._model.length; line++) {
            let i = 0;
            const { tokens1 } = this._getTokensAtLine(line);
            if (line === originLine) {
                i = index + 1;
            }

            for (; i < tokens1.length; i++) {
                const { scopes, endIndex: ei } = this._posScopesParse(line, i);
                if (checkHandle(scopes)) {
                    endIndex = ei;
                    endLine = line;
                    skipEnable = true;
                } else if(skipEnable && skipHandle && skipHandle(scopes)) {
                    skipEnable = false;
                    continue;
                } else {
                    break;
                }
            }
            if (i < tokens1.length || single || !skipEnable) break;
        }
        const range = new Range(
            startLine, startIndex,
            endLine, endIndex
        );


        let tokens = this._getCommentTokens(range, opts);
        let comment = this._textDocument.getText(range);

        return {
            comment,
            range,
            tokens
        }
    }

    /**
     * 获取注释范围内的CommentToken
     * 
     * @param range 注释范围
     * @param opts 
     * @returns 
     */
    private _getCommentTokens(range: Range, opts?: { skipHandle?: checkScopeFunction, ignoreHandle?: checkScopeFunction }): ICommentToken[] {

        let startLine = range.start.line;
        let endLine = range.end.line;
        let tokens: ICommentToken[] = [];

        for (let line = startLine; line <= endLine; line++) {
            let ignoreEnd = 0;
            let ignoreStart = 0;

            let tk = this._getTokensAtLine(line).tokens1;
            let sIndex = 0;
            let eIndex = tk.length - 1;
            let sTextIndex = 0;
            let eTextIndex = this._model[line].length;
            if (line === startLine) {
                sIndex = this._posOffsetTokens(range.start);
                sTextIndex = range.start.character;
            }

            if (line === endLine) {
                // 结束位置，不是真实的位置。如字符串end
                eIndex = this._posOffsetTokens(new Position(line, range.end.character-1));
                eTextIndex = range.end.character;
            }

            let i = sIndex;
            for (; i < tk.length; i++) {
                let res = this._posScopesParse(line, i);
                // 行首的忽略，包括空白符与注释符号
                if (opts?.skipHandle && opts.skipHandle(res.scopes)) {
                    ignoreStart += res.text.length;
                } else if (opts?.ignoreHandle && opts.ignoreHandle(res.scopes)) {
                    ignoreStart += res.text.length;
                } else if (findLeadingWhitespaceOrUnpairedIndex(res.text) === res.text.length) {
                    ignoreStart += res.text.length;
                } else if(i ===0 && ignoreStart === 0) {
                    const match = res.text.match(/^\s+/);
                    ignoreStart =  match ? match[0].length : ignoreStart;
                } else {
                    break;
                }
            }

            for (let j = eIndex; j >= i; j -= 1) {
                let res = this._posScopesParse(line, j);
                // 行尾的忽略，只需要忽略注释符号，默认不存在空白符
                if (opts?.ignoreHandle && opts.ignoreHandle(res.scopes)) {
                    ignoreEnd += res.text.length;
                } else {
                    break;
                }
            }

            tokens.push({
                ignoreStart,
                ignoreEnd,
                text: this._model[line].substring(sTextIndex, eTextIndex)
            });
        }

        return tokens;
    }

    public getAllCommentScope({ start, end }: { start?: Position, end?: Position } = {}, checkHandle: checkScopeFunction, single: boolean = false, opts?: { skipHandle?: checkScopeFunction, ignoreHandle?: checkScopeFunction }): ICommentBlock[] | null {
        // 遍历所以注释
        let blocks = [];
        let startLine = 0;
        let endLine = this._model.length - 1;
        if (start && end) {
            if (start.line != end.line || start.character != end.character) {
                startLine = start.line;
                endLine = end.line;
            }
        }
        for (let line = startLine; line <= endLine; line += 1) {
            let { tokens1 } = this._getTokensAtLine(line);
            for (let index = 0; index < tokens1.length; index += 1) {
                const { scopes, startIndex } = this._posScopesParse(line, index);
                if (scopes && checkHandle(scopes)) {
                    let block = this.commentScopeParse(new Position(line, startIndex + 1), checkHandle, single, opts);
                    blocks.push(block);
                    line = block.range.end.line;
                    tokens1 = this._getTokensAtLine(line).tokens1;
                    index = this._posOffsetTokens(block.range.end);
                }
            }
        }
        return blocks;
    }

    public computeAllText(type = 'comment', range: { start?: Position, end?: Position } = {}) {
        if (type === 'text') {
            return this.getAllCommentScope(range, isString, false, { ignoreHandle: ignoreString });
        } else {
            return this.getAllCommentScope(range, isComment, false, {
                ignoreHandle: ignoreComment, skipHandle: skipComment
            });
        }
    }

    public computeText(position: Position): ICommentBlock | null {
        const index = this._posOffsetTokens(position);
        const { scopes, startIndex, endIndex, text } = this._posScopesParse(position.line, index);
        const stringHover = getConfig<boolean>('hover.string');
        const variableHover = getConfig<boolean>('hover.variable');
        if (scopes && isComment(scopes)) {
            return this.commentScopeParse(position, isComment, false, {
                ignoreHandle: ignoreComment, skipHandle: skipComment
            });
        }
        //字符串中包含 \n 等， 需要在当前行，合并连续token
        if (stringHover && scopes && isString(scopes)) {
            return this.commentScopeParse(position, isString, false, { ignoreHandle: ignoreString });
        }

        if (variableHover && scopes && isBase(scopes)) {
            const range = new Range(new Position(position.line, startIndex), new Position(position.line, endIndex));

            return {
                comment: text,
                range: range
            }
        }

        return null;
    }

    public getWordAtPosition(position: Position) {
        const index = this._posOffsetTokens(position);
        const { scopes, startIndex, endIndex, text } = this._posScopesParse(position.line, index);

        if (scopes && isBase(scopes)) {
            const range = new Range(new Position(position.line, startIndex), new Position(position.line, endIndex));

            return {
                comment: text,
                scopes,
                range: range
            }
        }

        return null;
    }
}