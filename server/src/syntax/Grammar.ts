import { TextDocument, Position } from "vscode-languageserver";
import { IGrammar, StackElement } from "./TextMateService";

export class Grammar {
    private _model: string[];
    constructor(textDocument: TextDocument) {
        this._model = textDocument.getText().split('\n');
    }

    private _getStateBeforeLine(grammar: IGrammar, lineNumber: number): StackElement | null {
        let state: StackElement | null = null;

        for (let i = 1; i < lineNumber; i++) {
            let tokenizationResult = grammar.tokenizeLine(this._model[i], state);
            state = tokenizationResult.ruleStack;
        }

        return state;
    }

    private _getTokensAtLine(grammar: IGrammar, lineNumber: number) {
        let stateBeforeLine = this._getStateBeforeLine(grammar, lineNumber);

        let tokenizationResult1 = grammar.tokenizeLine(this._model[lineNumber], stateBeforeLine);
        let tokenizationResult2 = grammar.tokenizeLine2(this._model[lineNumber], stateBeforeLine);

        return {
            startState: stateBeforeLine,
            tokens1: tokenizationResult1.tokens,
            tokens2: tokenizationResult2.tokens,
            endState: tokenizationResult1.ruleStack
        };
    }

    public compute(grammar: IGrammar, position: Position) {
        let data = this._getTokensAtLine(grammar, position.line);
        let token1Index = 0;
        for (let i = data.tokens1.length - 1; i >= 0; i--) {
            let t = data.tokens1[i];
            if (position.character - 1 >= t.startIndex) {
                token1Index = i;
                break;
            }
        }

        let tokenStartIndex = data.tokens1[token1Index].startIndex;
        let tokenEndIndex = data.tokens1[token1Index].endIndex;
        let tokenText = this._model[position.line].substring(tokenStartIndex, tokenEndIndex);

        let scopes: string[] = [];
        for (let i = data.tokens1[token1Index].scopes.length - 1; i >= 0; i--) {
            scopes.push(escape(data.tokens1[token1Index].scopes[i]))
        }

        return {
            scopes,
            tokenText,
            tokenStartIndex,
            tokenEndIndex
        };
    }
}