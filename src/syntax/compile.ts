import humanizeString = require("humanize-string");
import { getConfig } from "../configuration";
import { autoMutualTranslate, translateManager } from "../translate/manager";
import { hasEndMark, isLowerCase, isUpperCase } from "../util/string";
import { ICommentBlock, ICommentToken, ITranslatedText } from "../interface";



function ignoreStringTag(tokens: ICommentToken[], regular: string) {
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
        // Converted to natural language
        return humanizeString(originText);
    }
    return '';
}

function combineLine(texts: string[]) {
    let combined: boolean[] = []; // 标记被合并行。 便于翻译后重新组合
    let combinedTexts = texts.reduce<string[]>((prev, curr, index) => {
        let lastIndex = combined.lastIndexOf(false);
        combined[index] = false;
        if (prev.length > 0) {
            let last = prev[lastIndex];
            if (isUpperCase(last) && hasEndMark(last) && isLowerCase(curr)) {
                // If it can be merged, merge to the previous row
                prev[lastIndex] = last + ' ' + curr;
                //The current line is blank, but the blank placeholder remains
                curr = '';
                combined[index] = true;
            }
        }
        prev.push(curr);
        return prev;
    }, []);

    return { combined, combinedTexts };
}


function getIgnoreRegular(languageId: string) {
    const ignore = getConfig<{ languageId: string, regular: string }[]>('ignore');
    if (!ignore) return '';
    let { regular = '' } = ignore.find(item => {
        return item.languageId.split(',').some((text => text.trim() === languageId));
    }) || {};
    return regular;
}

export async function compileBlock(block: ICommentBlock, languageId: string, targetLanguage?: string): Promise<ITranslatedText> {

    let translatedText: string;
    let targets: string[] = [];
    let texts: string[] = [];
    let combined: boolean[] = []; // Marked as merged rows for easy regrouping after translation
    let humanizeText: string = '';
    const { comment: originText, range } = block;
    let { tokens } = block;

    // 检查是否是单行注释（在同一行）
    const isSingleLine = range && range.start.line === range.end.line;

    if (!tokens) {
        // No tokens means select translation or single word translation, only need to produce simple results
        humanizeText = humanize(originText);
        translatedText = await autoMutualTranslate(humanizeText || originText, { to: targetLanguage });
        // 如果是单行注释，确保末尾没有换行符
        if (isSingleLine) {
            translatedText = translatedText.replace(/[\r\n]+$/, '');
        }
    } else {
        // Tokens represent comments, strings, and need to be structured

        // Regular ignore partial structure content
        let regular = getIgnoreRegular(languageId) || '[\\s|/]+';
        tokens = ignoreStringTag(tokens, regular);

        // Get the string to be translated.
        texts = tokens.map(({ text, ignoreStart = 0, ignoreEnd = 0 }) => {
            return text.slice(ignoreStart, text.length - ignoreEnd).trim();
        });

        // When multiline merge is enabled, multiple lines in a valid string are merged into the same line.
        if (getConfig<boolean>('multiLineMerge')) {
            let res = combineLine(texts);
            combined = res.combined;
            texts = res.combinedTexts;
        }

        // Filter blank lines to solve the problem of partial translation source, multi-line blank compression.
        let validTexts = texts.filter(text => {
            return text.length > 0;
        });
        let validText = validTexts.join('\n');
        let validTextLen = validText.length;

        // When there is no string to translate, the empty string is displayed directly, skipping the translation process.
        if (validTextLen === 0) {
            translatedText = originText;
        } else {
            // 只有1行，并且符合大小切换
            if (tokens.length === 1) {
                humanizeText = humanize(validText);
            }
            translatedText = await autoMutualTranslate(humanizeText || validText, { to: targetLanguage });

            // Reassemble the translation results to restore the filtered matches when translated, such as/* //, etc.
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
                    // Merged rows skipped
                    if (targetText === '' && combined[i]) {
                        continue;
                    }
                    const startText = text.slice(0, ignoreStart);
                    const endText = text.slice(text.length - ignoreEnd);
                    translated.push(startText + targetText + endText);
                }
                // 如果是单行注释，确保末尾没有换行符
                translatedText = isSingleLine ? translated[0].replace(/[\r\n]+$/, '') : translated.join('\n');
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
