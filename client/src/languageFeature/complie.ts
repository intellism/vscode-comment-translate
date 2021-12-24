import humanizeString = require("humanize-string");
import { Range, Position, window } from "vscode";
import { getConfig } from "../configuration";
import { client, translator } from "../extension";
// import { comment, connection, getConfig, translator } from "../server";
// import { ICommentBlock } from "../syntax/CommentParse";
import { ShortLive } from "../util/short-live";
import { hasEndMark, isLowerCase, isUpperCase } from "../util/string";

export interface ICommentBlock {
    humanize?: boolean;
    range: Range;
    comment: string;
    tokens?: ICommentToken[];
}
interface ICommentToken {
    ignoreStart?:number;
    ignoreEnd?:number;
    text:string;
    scope:IScopeLen[];
}

interface IScopeLen{
    scopes:string[];
    len:number;
}

export let shortLive = new ShortLive<string>((prev, curr) => prev===curr);

export interface ITranslateHover {
	originText: string;
	translatedText: string;
	translatedLink: string;
	humanizeText?: string;
	range: Range;
}

function selectionContains(url:string, position:Position):ICommentBlock | null {
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

export async function getHover(url:string, position:Position): Promise<ITranslateHover | null> {
	const concise = getConfig<boolean>('hover.concise');
	const open = getConfig<boolean>('hover.open');
	const multiLineMerge = getConfig<boolean>('multiLineMerge');
	if (!open) return null;
	if (concise && !shortLive.isLive(url)) return null;

	// 改为本地
	let block: ICommentBlock | null = selectionContains(url,position);
	if (!block) {
		// TODO 改为远程
		block = await client.sendRequest<ICommentBlock | null>('getComment', {textDocument: {uri: url},position});
	}
	if (!block) {
		return null;
	}
	let translatedText: string;
	let humanizeText: string = '';
	let { tokens } = block;
	const { comment: originText, range } = block;
	if (tokens) {
		// TODO 文本处理 可以抽离出去，后面正则过滤的时候迁移
		let texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
			return text.slice(ignoreStart, text.length - ignoreEnd).trim();
		});

		// 合并行
		let combined: boolean[] = [];
		if (multiLineMerge) {
			texts = texts.reduce<string[]>((prev, curr, index) => {
				let lastIndex = combined.lastIndexOf(false);
				combined[index] = false;
				if (prev.length > 0) {
					let last = prev[lastIndex];
					if (isUpperCase(last) && hasEndMark(last) && isLowerCase(curr)) {
						// 如果可以合并，合并到上一行
						prev[lastIndex] = last + ' ' + curr;
						//当前行空掉，但是保留空白占位符
						curr = '';
						combined[index] = true;
					}
				}
				prev.push(curr);
				return prev;
			}, []);
		}

		let validTexts = texts.filter(text => {
			return text.length > 0;
		});
		let comment = validTexts.join('\n');

		// 只有1行，并且符合大小切换
		if (tokens.length === 1) {
			const needHumanize = comment.trim().indexOf(' ') < 0;
			if (needHumanize) {
				// 转换为可以自然语言分割
				humanizeText = humanizeString(comment);
			}
		}
		translatedText = await translator.translate(humanizeText || comment);
		// 优化显示
		let targets = translatedText.split('\n');
		if (validTexts.length === targets.length) {
			let translated = [];
			for (let i = 0, j = 0; i < tokens.length; i++) {
				const { text, ignoreStart = 0, ignoreEnd = 0 } = tokens[i];
				const translateText = texts[i];
				let targetText = '';
				if (translateText.length > 0) {
					targetText = targets[j];
					j += 1;
				}
				// 被合并的行跳过
				if (targetText === '' && combined[i]) {
					continue;
				}
				translated.push(text.slice(0, ignoreStart) + targetText + text.slice(text.length - ignoreEnd));
			}
			translatedText = translated.join('\n');
		}
	} else {
		const needHumanize = originText.trim().indexOf(' ') < 0;
		if (needHumanize) {
			// 转换为可以自然语言分割
			humanizeText = humanizeString(originText);
		}
		translatedText = await translator.translate(humanizeText || originText);
	}

	return {
		originText,
		range,
		translatedText,
		humanizeText,
		translatedLink: translator.link(humanizeText || originText)
	};
}
