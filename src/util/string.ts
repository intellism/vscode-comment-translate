import { window } from "vscode";

export function isUpperCase(ch: string) {
    return ch >= 'A' && ch <= 'Z'
}

export function isLowerCase(ch: string) {
    return ch >= 'a' && ch <= 'z'
}

export function hasEndMark(ch: string) {
    let lastLineEndCharacter = ch.substring(ch.length - 1);
    return lastLineEndCharacter !== '.';
}


export function hasCode(text: string, symbols: string) {
    for (let symbol of symbols) {
        if (text.indexOf(symbol) >= 0) return true;
    }
    return false;
}

export function isCode(text: string): boolean {
    const codeSymbols = ['=', ',', '{}', '()', '<>', ':.;'];
    const quotationMarks = ['"', '\''];

    let score = 0;

    codeSymbols.forEach(symbol => {
        if (text.includes(symbol)) {
            score += 10;
        }
    });

    quotationMarks.forEach(mark => {
        if (text.includes(mark)) {
            score += 20;
        }
    });

    const isLongText = text.length > 200;
    const highScore = score > 40;

    if (isLongText && highScore) {
        return true;
    }

    return score > 20;
}


// TODO:This method needs to be optimized, or is it not accurate enough to accurately determine the code.
// export function isCodeByFlourite(text: string) {
//     const flourite = require('flourite/dist/index.cjs');
//     return flourite(text);
// }


export function countTabs(text: string): number {
    let tabCount = 0;
    for (let char of text) {
        if (char === '\t') {
            tabCount++;
        }
    }
    return tabCount;
}

// 获取当前编辑器的 tabSize
export function getTabSize(): number {
    const editor = window.activeTextEditor;
    if (editor) {
        const tabSize = editor.options.tabSize;
        if (typeof tabSize === 'number') {
            return tabSize;
        }
    }
    // 默认 tabSize
    return 4;
}

export function getTextLength(text: string = ''): number {
    return text.length + countTabs(text) * (getTabSize() - 1);
}
