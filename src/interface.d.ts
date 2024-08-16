import { Range } from "vscode";
import { StackElement, IToken, IGrammarExtensions } from "./syntax/TextMateService";

export interface ITokenState {
    startState: StackElement | null;
    tokens1: IToken[];
    endState: StackElement | null;
}

export interface IScopeLen {
    scopes: string[];
    len: number;
}

export interface ICommentToken {
    ignoreStart?: number;
    ignoreEnd?: number;
    text: string;
    scope?: IScopeLen[];
}

export interface ICommentOption {
    appRoot: string;
    grammarExtensions: IGrammarExtensions[];
    userLanguage: string;
}


export type checkScopeFunction = (scopes: string[]) => boolean;


export interface ICommentBlock {
	range: Range;
	comment: string;
	tokens?: ICommentToken[];
}



export interface ITranslatedText {
	translatedText: string;
	humanizeText?: string;
	targets: string[];
	texts:string[];
	combined:boolean[];
	translateLink: string;
}