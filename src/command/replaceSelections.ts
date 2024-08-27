import { Selection, window, Range, Position, TextDocument, commands } from "vscode";
import { getConfig, selectTargetLanguage } from "../configuration";
import { comment, ctx, outputChannel, translateManager } from "../extension";
import * as changeCase from "change-case";
import humanizeString = require("humanize-string");
import {franc} from 'franc'

async function translateSelection(text: string, selection: Selection, targetLanguage: string) {
    // let translation = await client.sendRequest<string>('translate', { text, targetLanguage });
    let translatedText = await translateManager.translate(text, { to: targetLanguage });
    return { translatedText, selection };
}

export async function replaceRange({ uri, text, range }: { uri: string, text: string, range: Range }) {
    let editor = window.activeTextEditor;
    // 传入uri已经被decode了,所以都decode一下
    if (!(editor && editor.document && decodeURIComponent(editor.document.uri.toString()) === decodeURIComponent(uri))) {
        return outputChannel.append(`Not active editor`);
    }

    text = Buffer.from(text, 'base64').toString();
    let decoration = window.createTextEditorDecorationType({
        color: '#FF2D00',
        backgroundColor: "transparent",
        before: {
            contentIconPath: ctx.asAbsolutePath('resources/icons/loading.svg'),
        }
    });
    editor.setDecorations(decoration, [range]);
    setTimeout(() => {
        decoration.dispose();
    }, 500);
    try {
        editor.revealRange(range);
        editor.edit(builder => {
            text && builder.replace(new Selection(new Position(range.start.line, range.start.character), new Position(range.end.line, range.end.character)), text);
        });
    } catch (e: any) {
        decoration.dispose();
        outputChannel.append(e.toString());
    }

}


let variableCompletionMap = new Map<string, { value: string,filterText: string,codeType: string, range: Range }>();

let caseGuide: { [key: string]: string } = {
    variable: 'camelCase',
    function: 'camelCase',
    class: 'pascalCase',
    readonly: 'constantCase',
};

export function setCaseGuide(key:string , value:string) {
    caseGuide[key] = value;
}

export function getVariableCompletionDatas(doc: TextDocument, position: Position) {
    let key = doc.uri.toString() + ':' + position.line + ':' + position.character;
    if (variableCompletionMap.has(key)) {
        let { value, range,filterText,codeType } = variableCompletionMap.get(key)!;
        let r = new Range(range.start.line, range.start.character, range.end.line, range.end.character+1);
        return {
            caseGuide,
            value,
            codeType,
            filterText,
            range:r,
            list: [
                {
                    title: 'camelCase',
                    value: changeCase.camelCase(value),
                },
                {
                    title: 'pascalCase',
                    value: changeCase.pascalCase(value),
                },
                {
                    title: 'constantCase',
                    value: changeCase.constantCase(value),
                },
                {
                    title: 'snakeCase',
                    value: changeCase.snakeCase(value),
                }, {
                    title: 'pascalSnakeCase',
                    value: changeCase.pascalSnakeCase(value),
                },
                {
                    title: 'kebabCase',
                    value: changeCase.kebabCase(value),
                },
                {
                    title: 'trainCase',
                    value: changeCase.trainCase(value),
                },
            ]
        };
    }
    return null;
}

export function addVariableCompletion(doc: TextDocument, position: Position, value: string, range: Range,filterText:string,codeType:string) {
    let key = doc.uri.toString() + ':' + position.line + ':' + position.character;
    variableCompletionMap.set(key, { value, range,filterText,codeType });
}

export function removeVariableCompletion(doc: TextDocument, position: Position) {
    let key = doc.uri.toString() + ':' + position.line + ':' + position.character;
    variableCompletionMap.delete(key);
}


function convertSentenceToVariable(sentence: string): string {
    // 去除标点符号
    const cleanedSentence = sentence.replace(/[^\w\s]/g, '');
    // 转换成小写
    const lowerCaseSentence = cleanedSentence.toLowerCase();
    // 分隔单词
    const words = lowerCaseSentence.split(' ');
    // 将每个单词的首字母大写（除了第一个单词）
    const camelCaseWords = words.map((word, index) => {
        if (index === 0) {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    });
    // 连接成一个字符串
    return camelCaseWords.join('');
}

async function replaceVariable(position: Position) {
    let editor = window.activeTextEditor;
    if (!editor || !editor.document) return;
    let word = await comment.getWordAtPosition(editor.document, new Position(position.line, Math.max(0, position.character - 1)));
    if (!word || !word.comment.trim()) return;
    let { range, comment: text, scopes } = word;

    // 替换word.range的内容到word.comment
    let decoration = window.createTextEditorDecorationType({
        after: {
            contentIconPath: ctx.asAbsolutePath('resources/icons/loading.svg'),
        }
    });
    editor.setDecorations(decoration, [range]);

    let translatedText:string;

    // 文本比较短，cld3很容易识别错误。 franc的限定语言效果更好
    let languageId = franc(humanizeString(text),{minLength:1,only:['eng']});
    if(languageId === 'eng') {
        translatedText = humanizeString(text);
    } else {
        translatedText = await translateManager.translate(text, { to: 'en' });
    }
    decoration.dispose();

    let codeType = getCodeType(scopes);

    addVariableCompletion(editor.document, position, translatedText, range,text,codeType);
    commands.executeCommand('editor.action.triggerSuggest');
}

//翻译选择区域并替换
export async function replaceSelections() {
    let editor = window.activeTextEditor;

    if (!editor || !editor.document || !editor.selections || editor.selections.length === 0) {
        return outputChannel.append(`No editor and document!\n`);
    }
    if (editor.selection.isEmpty) {
        return replaceVariable(editor.selection.start);
    }

    const validSelections = editor.selections
        .filter(selection => !selection.isEmpty);

    if (validSelections.length === 0) {
        return outputChannel.append(`No selection！\n`);
    }

    // let targetLanguage = getConfig<string>('targetLanguage',userLanguage);
    // if (!targetLanguage) return;

    let targetLanguage: string;
    let selectTarget = getConfig<boolean>('selectTargetLanguageWhenReplacing');
    if (selectTarget) {
        targetLanguage = await selectTargetLanguage();
        if (!targetLanguage) return;
    }

    let translates = validSelections.map(selection => {
        // @ts-ignore
        let text = editor.document.getText(selection);
        return translateSelection(text, selection, targetLanguage);
    });

    //添加装饰，提醒用户正在翻译中。 部分内容会原样返回，避免用户等待
    let decoration = window.createTextEditorDecorationType({
        color: '#FF2D00',
        backgroundColor: "transparent",
        after: {
            contentIconPath: ctx.asAbsolutePath('resources/icons/loading.svg'),
        }
    });
    editor.setDecorations(decoration, editor.selections);
    let beginTime = Date.now();
    try {
        let results = await Promise.all(translates);
        //最少提示1秒钟
        setTimeout(() => {
            decoration.dispose();
        }, 1000 - (Date.now() - beginTime));
        editor.edit(builder => {
            results.forEach(({ translatedText, selection }) => {
                translatedText && builder.replace(selection, translatedText);
            });
        });
    } catch (e: any) {
        decoration.dispose();
        outputChannel.append(e.toString());
    }
}

function getCodeType(scopes:string[]) {
    if(scopes[0].indexOf('variable') === 0) {
        if(scopes[0].indexOf('constant') >=0) {
            return 'readonly';
        }

        return 'variable';
    }

    if(scopes[0].indexOf('entity.name.function') === 0) {
        return 'function';
    }

    if(scopes[0].indexOf('entity.name.class') === 0 ||
        scopes[0].indexOf('entity.name.type.class') === 0) {
        return 'class';
    }

    return '';
}