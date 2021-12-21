import humanizeString = require("humanize-string");
import { Hover, Range, TextDocumentPositionParams } from "vscode-languageserver/node";
import { comment, connection, getConfig, translator } from "../server";
import { ICommentBlock } from "../syntax/CommentParse";
import { ShortLive } from "../util/short-live";

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
	const { hover: { concise, open } } = getConfig();
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
		const needHumanize = originText.trim().indexOf(' ') < 0;
		if (needHumanize) {
			// 转换为可以自然语言分割
			humanizeText = humanizeString(originText);
			translatedText = await translator.translate(humanizeText);
		} else if (tokens) {
			// TODO 文本处理 可以抽离出去，后面正则过滤的时候迁移
			let texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
				return text.slice(ignoreStart, text.length - ignoreEnd).trim();
			});
			let validTexts = texts.filter(text=>{
				return text.length>0;
			});
			let comment = validTexts.join('\n');
			translatedText = await translator.translate(comment);
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
					translated.push(text.slice(0, ignoreStart) + targetText + text.slice(text.length - ignoreEnd));
				}
				translatedText = translated.join('\n');
			}
		} else {
			translatedText = await translator.translate(originText);
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
