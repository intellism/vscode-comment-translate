import humanizeString = require("humanize-string");
import { getConfig } from "../configuration";
import { autoMutualTranslate, translateManager } from "../extension";
import { hasEndMark, isLowerCase, isUpperCase } from "../util/string";
import { ICommentBlock, ICommentToken, ITranslatedText } from "../interface";



function ignoreStringTag(tokens: ICommentToken[], regular: string) {
	// const regular = '[\\*\\s]+';
	if (regular) {
		return tokens.map(item => {
			let { ignoreStart = 0, ignoreEnd = 0, text } = item;
			const validText = text.slice(ignoreStart, text.length - ignoreEnd);
			let match = validText.match('^' + regular);
			if (match && match.length) {
				ignoreStart += match[0].length;
			}
			item.ignoreStart = ignoreStart;

			let endMatch = validText.match('\\s+$');
			if (endMatch && endMatch.length) {
				ignoreEnd += endMatch[0].length;
			}
			item.ignoreEnd = ignoreEnd;

			return item;
		});
	}
	return tokens;
}

function humanize(originText: string) {
	const needHumanize = originText.trim().indexOf(' ') < 0;
	if (needHumanize) {
		// 转换为可以自然语言分割
		return humanizeString(originText);
	}
	return '';
}

function combineLine(texts:string[]) {
	let combined: boolean[] = []; // 标记被合并行。 便于翻译后重新组合
	let combinedTexts =  texts.reduce<string[]>((prev, curr, index) => {
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

	return {combined, combinedTexts};
}


function getIgnoreRegular(languageId:string) {
	const ignore = getConfig<{languageId:string,regular:string}[]>('ignore');
	if(!ignore) return '';
	let {regular=''} = ignore.find(item=>{
		return item.languageId.split(',').some((text=>text.trim()===languageId));
	}) || {};
	return regular;
}

export async function compileBlock(block:ICommentBlock,languageId:string,targetLanguage?:string): Promise<ITranslatedText> {

	let translatedText: string;
	let targets:string[] = [];
	let texts:string[] = [];
	let combined: boolean[] = []; // 标记被合并行。 便于翻译后重新组合
	let humanizeText: string = '';
	const { comment: originText } = block;
	let { tokens } = block;

	// targetLanguage = targetLanguage || getConfig<string>('targetLanguage', userLanguage);
	if (!tokens) {
		// 选取翻译&单个单词翻译的时候。无tokens的简单结果
		humanizeText = humanize(originText);
		// translatedText = await translateManager.translate(humanizeText || originText, { to: targetLanguage });
		translatedText = await autoMutualTranslate(humanizeText || originText, { to: targetLanguage });
	} else {
		// 注释、文本，有tokens的语义翻译处理。
		
		// 正则忽略
		let regular = getIgnoreRegular(languageId) || '[\\s|/]+';
		tokens = ignoreStringTag(tokens,regular);

		// 获取待翻译字符串。
		texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
			return text.slice(ignoreStart, text.length - ignoreEnd).trim();
		});

		// 开启多行合并的时候，合并有效字符串中的多行到同一行。
		
		if (getConfig<boolean>('multiLineMerge')) {
			let res = combineLine(texts);
			combined = res.combined;
			texts = res.combinedTexts;
		}

		// 过滤空白行，解决部分翻译源，多行空白会压缩问题。
		let validTexts = texts.filter(text => {
			return text.length > 0;
		});
		let validText = validTexts.join('\n');
		let validTextLen = validText.length;
		
		// 没有需要翻译的字符串，直接显示空字符串，跳过翻译过程。
		if (validTextLen === 0) {
			translatedText = originText;
		} else {
			// 只有1行，并且符合大小切换
			if (tokens.length === 1) {
				humanizeText = humanize(validText);
			}
			// translatedText = await translateManager.translate(humanizeText || validText, { to: targetLanguage });
			translatedText = await autoMutualTranslate(humanizeText || validText, { to: targetLanguage });

			// 重新组合翻译结果，还原被翻译时过滤的符合.  如 /* // 等
			targets = translatedText.split('\n');
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
		translatedText,
		humanizeText,
		targets,
		texts,
		combined,
		translateLink: translateManager.link(humanizeText || originText)
	};
}
