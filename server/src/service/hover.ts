import humanizeString = require("humanize-string");
import { Hover, Range, TextDocumentPositionParams } from "vscode-languageserver/node";
import { comment, connection, getConfig, translator } from "../server";
import { ICommentBlock } from "../syntax/CommentParse";
import { ShortLive } from "../util/short-live";
import { hasEndMark, isLowerCase, isUpperCase } from "../util/string";

export let shortLive = new ShortLive((item: TextDocumentPositionParams, data: TextDocumentPositionParams) => {
	if (item.textDocument.uri === data.textDocument.uri) {
		return true;
	}
	return false;
});

export interface ITranslateHover {
	originText: string;
	translatedText: string;
	translatedLink: string;
	humanizeText?: string;
	range: Range;
}

export async function getHover(textDocumentPosition: TextDocumentPositionParams): Promise<ITranslateHover | null> {
	const { hover: { concise, open }, multiLineMerge } = getConfig();
	if (!open || !comment) return null;
	if (concise && !shortLive.isLive(textDocumentPosition)) return null;

	let block: ICommentBlock | null = await connection.sendRequest<ICommentBlock>('selectionContains', textDocumentPosition);
	if (!block) {
		block = await comment.getComment1(textDocumentPosition);
	}
	if (block) {
		let translatedText: string;
		let humanizeText: string = '';
		const { comment: originText, range } = block;
		let {tokens} = block;
		if (tokens) {
			// TODO 文本处理 可以抽离出去，后面正则过滤的时候迁移
			let texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
				return text.slice(ignoreStart, text.length - ignoreEnd).trim();
			});

			// 合并行
			let combined:boolean[] = [];
			if(multiLineMerge) {
				texts = texts.reduce<string[]>((prev,curr,index)=>{
					let lastIndex = combined.lastIndexOf(false);
					combined[index] = false;
					if(prev.length>0) {
						let last = prev[lastIndex];
						if (isUpperCase(last) && hasEndMark(last) && isLowerCase(curr)) {
							// 如果可以合并，合并到上一行
							prev[lastIndex] = last+ ' ' + curr;
							//当前行空掉，但是保留空白占位符
							curr = '';
							combined[index] = true;
						}
					}
					prev.push(curr);
					return prev;
				},[]);
			}

			let validTexts = texts.filter(text=>{
				return text.length>0;
			});
			let comment = validTexts.join('\n');

			// 只有1行，并且符合大小切换
			if(tokens.length === 1 ) {
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
				for(let i=0,j=0; i<tokens.length; i++) {
					const {text, ignoreStart = 0, ignoreEnd = 0} = tokens[i];
					const translateText = texts[i];
					let targetText = '';
					if(translateText.length>0) {
						targetText = targets[j];
						j+=1;
					}
					// 被合并的行跳过
					if(targetText === '' && combined[i]){
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

	return null;
}
