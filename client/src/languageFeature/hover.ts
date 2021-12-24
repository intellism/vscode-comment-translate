import { Hover, languages, MarkdownString, Range } from "vscode";
import { getConfig } from "../configuration";
import { getHover } from "./complie";

export interface ITranslateHover {
	originText: string;
	translatedText: string;
	translatedLink: string;
	humanizeText?: string;
	range: Range;
}

let last: Map<string, Hover> = new Map();
export function registerHover(canLanguages:string[] = []) {

    languages.registerHoverProvider(canLanguages, {
        async provideHover(document, position) {
            
            const uri = document.uri.toString();
            const res = await getHover(uri, position);
            if(!res) return null;
            const {translatedText,translatedLink,humanizeText,range} = res;
            const base64TranslatedText = Buffer.from(translatedText).toString('base64');
            const space = '&nbsp;&nbsp;';
            const separator = `${space}|${space}`;
            const replace = `[$(replace)](command:commentTranslate._replaceRange?${encodeURIComponent(JSON.stringify({uri,range,text:base64TranslatedText}))} "Replace")`;
            const multiLine = getConfig<boolean>('multiLineMerge');
            const combine = `[$(${multiLine?'selection':'remove'})](command:commentTranslate._toggleMultiLineMerge "Toggle Combine Multi Line")`;

            const setting = `[$(settings-gear)](command:workbench.action.openWorkspaceSettings?${encodeURIComponent(JSON.stringify({query:'commentTranslate'}))} "Open Comment Translate setting")`;

            const translate = `[$(sync)](command:commentTranslate._changeTranslateSource "Change translate source")`;

            const header = new MarkdownString(`[Comment Translate]${space}${replace}${space}${combine}${space}${setting}${separator}${translate}${space}${translatedLink}`,true);
            header.isTrusted = true;

            let showText = translatedText;
            if(humanizeText) {
                showText = `${humanizeText} => ${translatedText}`
            }
            const codeDefine = '```';
            let md = new MarkdownString(`${codeDefine}${document.languageId}\n${showText}\n ${codeDefine}`);
            const hover = new Hover([header,md], range);
            last.set(uri, hover);
            return hover;
        }
    });

}

export function lastHover(uri:string) {
	return last.get(uri);
}