import { ExtensionContext, Hover, languages, MarkdownString, Position, window } from "vscode";
import { getConfig } from "../configuration";
import { client } from "../extension";
import { ShortLive } from "../util/short-live";
import { compileBlock, ICommentBlock } from "./compile";

export let shortLive = new ShortLive<string>((prev, curr) => prev === curr);
let last: Map<string, Hover> = new Map();
export function registerHover(context: ExtensionContext, canLanguages:string[] = []) {

    let hoverProviderDisposable = languages.registerHoverProvider(canLanguages, {
        async provideHover(document, position) {

            const uri = document.uri.toString();
            const concise = getConfig<boolean>('hover.concise');
            const open = getConfig<boolean>('hover.enabled');

            if (!open) return null;
            if (concise && !shortLive.isLive(uri)) return null;

            let block: ICommentBlock | null = selectionContains(uri, position);
            if (!block) {
                const textDocumentPosition = { textDocument: { uri }, position };
                block = await client.sendRequest<ICommentBlock | null>('getComment', textDocumentPosition);
            }
            if (!block) {
                return null;
            }

            const translatedBlock = await compileBlock(block,document.languageId);
            const {translatedText, translateLink,humanizeText} = translatedBlock;
            const {range} = block;

            const base64TranslatedText = Buffer.from(translatedText).toString('base64');
            const space = '&nbsp;&nbsp;';
            const separator = `${space}|${space}`;
            const replace = `[$(replace)](command:commentTranslate._replaceRange?${encodeURIComponent(JSON.stringify({uri,range,text:base64TranslatedText}))} "Replace")`;
            const multiLine = getConfig<boolean>('multiLineMerge');
            const combine = `[$(${multiLine?'selection':'remove'})](command:commentTranslate._toggleMultiLineMerge "Toggle Combine Multi Line")`;

            const translate = `[$(sync)](command:commentTranslate.changeTranslateSource "Change translate source")`;

            const header = new MarkdownString(`[Comment Translate]${space}${replace}${space}${combine}${separator}${translate}${space}${translateLink}`,true);
            header.isTrusted = true;

            let showText = translatedText;
            if(humanizeText) {
                showText = `${humanizeText} => ${translatedText}`
            }
            const codeDefine = '```';
            let md = new MarkdownString(`${codeDefine}${document.languageId}\n${showText}\n ${codeDefine}`);
            if(!translatedText) {
                md = new MarkdownString(`**Translate Error**: Check [OutputPannel](command:commentTranslate._openOutputPannel "open output pannel") for details.`);
                md.isTrusted = true;
            }
            const hover = new Hover([header,md], range);
            last.set(uri, hover);
            return hover;
        }
    });

    context.subscriptions.push(hoverProviderDisposable);
}


function selectionContains(url: string, position: Position): ICommentBlock | null {
	let editor = window.activeTextEditor;
	//有活动editor，并且打开文档与请求文档一致时处理请求
	if (editor && editor.document.uri.toString() === url) {
		//类型转换
		let selection = editor.selections.find((selection) => {
			return !selection.isEmpty && selection.contains(position);
		});

		if (selection) {
			return {
				range: selection,
				comment: editor.document.getText(selection)
			};
		}
	}

	return null;
}

export function lastHover(uri:string) {
	return last.get(uri);
}