import humanizeString = require("humanize-string");
import { Range, Position, window } from "vscode";
import { getConfig } from "../configuration";
import { client, translateManager } from "../extension";
import { ShortLive } from "../util/short-live";
import { hasEndMark, isLowerCase, isUpperCase } from "../util/string";

export interface ICommentBlock {
	humanize?: boolean;
	range: Range;
	comment: string;
	tokens?: ICommentToken[];
}
interface ICommentToken {
	ignoreStart?: number;
	ignoreEnd?: number;
	text: string;
	scope: IScopeLen[];
}

interface IScopeLen {
	scopes: string[];
	len: number;
}

export let shortLive = new ShortLive<string>((prev, curr) => prev === curr);

export interface ITranslateHover {
	originText: string;
	translatedText: string;
	translatedLink: string;
	humanizeText?: string;
	range: Range;
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

export async function getHover(url: string, position: Position): Promise<ITranslateHover | null> {
	const concise = getConfig<boolean>('hover.concise');
	const open = getConfig<boolean>('hover.open');
	const targetLanguage = getConfig<string>('targetLanguage');
	const multiLineMerge = getConfig<boolean>('multiLineMerge');
	if (!open) return null;
	if (concise && !shortLive.isLive(url)) return null;

	let block: ICommentBlock | null = selectionContains(url, position);
	if (!block) {
		const textDocumentPosition = { textDocument: { uri: url }, position };
		block = await client.sendRequest<ICommentBlock | null>('getComment', textDocumentPosition);
	}
	if (!block) {
		return null;
	}

	let translatedText: string;
	let humanizeText: string = '';
	const { comment: originText, range, tokens } = block;

	if (!tokens) {
		// 选取翻译&单个单词翻译的时候。无tokens的简单结果
		const needHumanize = originText.trim().indexOf(' ') < 0;
		if (needHumanize) {
			// 转换为可以自然语言分割
			humanizeText = humanizeString(originText);
		}
		translatedText = await translateManager.translate(humanizeText || originText, { to: targetLanguage });
	} else {
		// 注释、文本，有tokens的语义翻译处理。
		// TODO 文本处理 可以抽离出去，后面正则过滤的时候迁移

		// 获取待翻译字符串。
		let texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
			return text.slice(ignoreStart, text.length - ignoreEnd).trim();
		});

		// 开启多行合并的时候，合并有效字符串中的多行到同一行。
		let combined: boolean[] = []; // 标记被合并行。 便于翻译后重新组合
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

		// 过滤空白行，解决部分翻译源，多行空白会压缩问题。
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

		const translateText = humanizeText || comment;
		if (!translateText) {
			translatedText = originText;
		} else {
			translatedText = await translateManager.translate(translateText, { to: targetLanguage });
			// 重新组合翻译结果，还原被翻译时过滤的符合.  如 /* // 等
			let targets = translatedText.split('\n');
			if (translatedText && validTexts.length === targets.length) {
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
					const startText = text.slice(0, ignoreStart);
					const endText = text.slice(text.length - ignoreEnd);
					translated.push(startText + targetText + endText);
				}
				translatedText = translated.join('\n');
			}
		}

	}

	return {
		originText,
		range,
		translatedText,
		humanizeText,
		translatedLink: translateManager.link(humanizeText || originText, { to: targetLanguage })
	};
}
