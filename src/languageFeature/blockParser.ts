import { TextDocument, Range } from "vscode";
import { checkScopeFunction, ICommentBlock } from "../interface";

export interface IFenceState {
    marker: '`' | '~';
    len: number;
}

export interface IMarkdownFenceScanResult {
    occupiedLines: Set<number>;
    inFenceAtRangeStart: boolean;
}

export interface ITextBlockOptions {
    isBoundary?: (trimText: string) => boolean;
}

export function parseFence(trimText: string): IFenceState | null {
    const match = trimText.match(/^([`~]{3,})/);
    if (!match || !match[1]) {
        return null;
    }

    const markerText = match[1];
    const marker = markerText[0];
    if ((marker !== '`' && marker !== '~') || markerText.split('').some((item) => item !== marker)) {
        return null;
    }

    return { marker, len: markerText.length };
}

export function isFenceClose(trimText: string, fence: IFenceState): boolean {
    const close = trimText.match(/^([`~]{3,})\s*$/);
    if (!close || !close[1]) {
        return false;
    }
    const markerText = close[1];
    return markerText[0] === fence.marker && markerText.length >= fence.len;
}

export function getFenceStateBeforeLine(document: TextDocument, endLineExclusive: number): IFenceState | null {
    let fence: IFenceState | null = null;

    for (let line = 0; line < endLineExclusive; line++) {
        const text = document.lineAt(line).text.trimStart();
        if (!fence) {
            const openFence = parseFence(text);
            if (openFence) {
                fence = openFence;
            }
            continue;
        }

        if (isFenceClose(text, fence)) {
            fence = null;
        }
    }

    return fence;
}

export const isMarkdownCodeScope: checkScopeFunction = (scopes) => {
    const rules = [
        /^markup\.fenced_code\.block\.markdown/,
        /^meta\.embedded\.block\./
    ];
    return scopes.some((scope) => rules.some((rule) => rule.test(scope)));
};

export function getExpandedVisibleRange(document: TextDocument, visibleRange: Range, paddingLines: number = 120): Range {
    const startLine = Math.max(0, visibleRange.start.line - paddingLines);
    const endLine = Math.min(document.lineCount - 1, visibleRange.end.line + paddingLines);
    const endLineText = document.lineAt(endLine).text;
    return new Range(startLine, 0, endLine, endLineText.length);
}

export function scanMarkdownFenceLines(document: TextDocument, visibleRange: Range): IMarkdownFenceScanResult {
    let fence = getFenceStateBeforeLine(document, visibleRange.start.line);
    const occupiedLines = new Set<number>();
    const inFenceAtRangeStart = !!fence;

    for (let line = visibleRange.start.line; line <= visibleRange.end.line; line++) {
        const text = document.lineAt(line).text;
        const trimText = text.trimStart();

        if (!fence) {
            const openFence = parseFence(trimText);
            if (openFence) {
                occupiedLines.add(line);
                fence = openFence;
                continue;
            }
        } else {
            occupiedLines.add(line);
            if (isFenceClose(trimText, fence)) {
                fence = null;
            }
        }
    }

    return { occupiedLines, inFenceAtRangeStart };
}

export function isMarkdownStructureBoundary(trimText: string): boolean {
    if (/^(?:[-*_]\s*){3,}$/.test(trimText)) {
        return true;
    }
    const tableSeparator = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/;
    return tableSeparator.test(trimText);
}

export function isRstStructureBoundary(trimText: string): boolean {
    if (!trimText) {
        return false;
    }
    if (/^([-=*~`^"'+#])\1{2,}$/.test(trimText)) {
        return true;
    }
    if (/^\.\.\s+/.test(trimText)) {
        return true;
    }
    if (/^[:\w-]+:\s+/.test(trimText)) {
        return true;
    }
    return false;
}

export function getMarkdownTextBlocks(
    document: TextDocument,
    visibleRange: Range,
    occupiedLineSet: Set<number>,
    inFenceAtRangeStart: boolean
): ICommentBlock[] {
    const blocks: ICommentBlock[] = [];
    let paragraphStart = -1;
    let paragraphTexts: string[] = [];

    const pushParagraph = () => {
        if (paragraphStart < 0 || paragraphTexts.length === 0) {
            paragraphStart = -1;
            paragraphTexts = [];
            return;
        }
        const endLine = paragraphStart + paragraphTexts.length - 1;
        const endLineText = document.lineAt(endLine).text;
        blocks.push({
            range: new Range(paragraphStart, 0, endLine, endLineText.length),
            comment: paragraphTexts.join('\n')
        });
        paragraphStart = -1;
        paragraphTexts = [];
    };

    let fence = inFenceAtRangeStart ? getFenceStateBeforeLine(document, visibleRange.start.line) : null;
    for (let line = visibleRange.start.line; line <= visibleRange.end.line; line++) {
        const text = document.lineAt(line).text;
        const trimText = text.trimStart();

        if (!fence) {
            const openFence = parseFence(trimText);
            if (openFence) {
                pushParagraph();
                fence = openFence;
                continue;
            }
        } else if (isFenceClose(trimText, fence)) {
            pushParagraph();
            fence = null;
            continue;
        }

        if (fence || occupiedLineSet.has(line)) {
            pushParagraph();
            continue;
        }

        if (trimText.trim().length === 0) {
            pushParagraph();
            continue;
        }

        if (isMarkdownStructureBoundary(trimText)) {
            pushParagraph();
            continue;
        }

        if (paragraphStart < 0) {
            paragraphStart = line;
        }
        paragraphTexts.push(text);
    }

    pushParagraph();
    return blocks;
}

export function getParagraphTextBlocks(document: TextDocument, range: Range, options: ITextBlockOptions = {}): ICommentBlock[] {
    const blocks: ICommentBlock[] = [];
    let paragraphStart = -1;
    let paragraphTexts: string[] = [];
    const isBoundary = options.isBoundary;

    const pushParagraph = () => {
        if (paragraphStart < 0 || paragraphTexts.length === 0) {
            paragraphStart = -1;
            paragraphTexts = [];
            return;
        }
        const endLine = paragraphStart + paragraphTexts.length - 1;
        const endLineText = document.lineAt(endLine).text;
        blocks.push({
            range: new Range(paragraphStart, 0, endLine, endLineText.length),
            comment: paragraphTexts.join('\n')
        });
        paragraphStart = -1;
        paragraphTexts = [];
    };

    for (let line = range.start.line; line <= range.end.line; line++) {
        const text = document.lineAt(line).text;
        const trimText = text.trimStart();

        if (trimText.trim().length === 0) {
            pushParagraph();
            continue;
        }

        if (isBoundary && isBoundary(trimText)) {
            pushParagraph();
            continue;
        }

        if (paragraphStart < 0) {
            paragraphStart = line;
        }
        paragraphTexts.push(text);
    }

    pushParagraph();
    return blocks;
}
