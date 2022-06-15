import { CancellationToken, commands, ExtensionContext, Hover, languages, MarkdownString, Position, Range, TextDocument, window } from "vscode";
import { getConfig } from "../configuration";
import { client, translateManager, userLanguage } from "../extension";
import { IMarkdownReplceToken, markdownRecovery, markdownReplace } from "../util/markdown";
import { ShortLive } from "../util/short-live";
import { compileBlock, ICommentBlock } from "./compile";

export let shortLive = new ShortLive<string>((prev, curr) => prev === curr);
let last: Map<string, Hover> = new Map();

let working: Set<String> = new Set();


async function commentProvideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | null> {

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

    const translatedBlock = await compileBlock(block, document.languageId);
    const { translatedText, translateLink, humanizeText } = translatedBlock;
    const { range } = block;

    const base64TranslatedText = Buffer.from(translatedText).toString('base64');
    const space = '&nbsp;&nbsp;';
    const separator = `${space}|${space}`;
    const replace = `[$(replace)](command:commentTranslate._replaceRange?${encodeURIComponent(JSON.stringify({ uri, range, text: base64TranslatedText }))} "Replace")`;
    const multiLine = getConfig<boolean>('multiLineMerge');
    const combine = `[$(${multiLine ? 'selection' : 'remove'})](command:commentTranslate._toggleMultiLineMerge "Toggle Combine Multi Line")`;
    const addSelection = `[$(heart)](command:commentTranslate._addSelection?${encodeURIComponent(JSON.stringify({ range }))} "Add Selection")`;

    const translate = `[$(sync)](command:commentTranslate.changeTranslateSource "Change translate source")`;

    const header = new MarkdownString(`[Comment Translate]${space}${replace}${space}${combine}${space}${addSelection}${separator}${translate}${space}${translateLink}`, true);
    header.isTrusted = true;

    let showText = translatedText;
    if (humanizeText) {
        showText = `${humanizeText} => ${translatedText}`
    }
    const codeDefine = '```';
    let md = new MarkdownString(`${codeDefine}${document.languageId}\n${showText}\n ${codeDefine}`);
    if (!translatedText) {
        md = new MarkdownString(`**Translate Error**: Check [OutputPannel](command:commentTranslate._openOutputPannel "open output pannel") for details.`);
        md.isTrusted = true;
    }
    const hover = new Hover([header, md], range);
    last.set(uri, hover);
    return hover;
}

async function translateTypeLanguageProvideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | null> {
    
    // translateTypeLanguage的开关，默认关闭
    const typeLanguae = getConfig<boolean>('hover.content');
    if(!typeLanguae) {
        return null;
    }

    let hoverId = getHoverId(document,position);
    working.add(hoverId); // 标识当前位置进行处理中。  当前Provider将忽略当次请求，规避循环调用。
    let res = await commands.executeCommand<Hover[]>('vscode.executeHoverProvider',document.uri, position);
    working.delete(hoverId); // 移除处理中的标识，使其他正常hover的响应
    let targetLanguage = getConfig<string>('targetLanguage') || userLanguage;

    let contents:{tokens:IMarkdownReplceToken[]}[] = [];
    let contentTasks:Promise<string>[] = [];
    let range:Range|undefined;
    res.forEach(hover=>{
        range = range || hover.range;
        hover.contents.forEach(c=>{
            // TODO 先全量翻译,后续特殊场景定制优化
            let markdownText:string;
            let tokens:IMarkdownReplceToken[];
            if(typeof c === 'string') {
                markdownText = c;
            } else {
                markdownText = c.value;
            }
            tokens = markdownReplace(markdownText);

            let onlyEmbed = true;
            tokens.forEach(token=>{
                if(token.text.length>0 && !token.embed) {
                    onlyEmbed = false;
                    return;
                }
            });
            if(!onlyEmbed) {
                let msg = tokens.map(token=>token.text).filter(text=>text.length>0).join('\n');
                contentTasks.push(translateManager.translate(msg, { to: targetLanguage }));
                contents.push({
                    tokens
                });
            }
            
        });
    });

    let translateds = await Promise.all(contentTasks);
    let markdownStrings =  translateds.map((translated,index)=>{
        translated = markdownRecovery(translated.split('\n'), contents[index].tokens);
        let md = new MarkdownString(translated,true);
        md.isTrusted = true;
        return md;
    });

    if(markdownStrings.length>0) {
        return new Hover(markdownStrings,range);
    }
    return null;
}

function getHoverId(document: TextDocument, position: Position) {
    return  `${document.uri.toString()}-${position.line}-${position.character}`;
}

export function registerHover(context: ExtensionContext, canLanguages:string[] = []) {

    let hoverProviderDisposable = languages.registerHoverProvider(canLanguages, {
        async provideHover(document, position, token) {

            const uri = document.uri.toString();
            let hoverId = getHoverId(document,position);
            // 如果已经当前Hover进行中，则忽略本次请求
            if(working.has(hoverId)) {
                return null;
            }
            
            let [typeLanguageHover, commentHover] = await Promise.all([translateTypeLanguageProvideHover(document,position,token), commentProvideHover(document,position,token)]);
            if(commentHover) {
                if(typeLanguageHover && typeLanguageHover.contents.length>0) {
                    commentHover.contents = commentHover.contents.concat(typeLanguageHover.contents);
                }
                return commentHover;
            } else {
                return typeLanguageHover;
            }
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