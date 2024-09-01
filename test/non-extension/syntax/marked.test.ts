
import { getMarkdownTextValue } from "../../../src/syntax/marked";
import { translateManager } from "../../../src/translate/manager";
import { marked } from "marked";
import { getFixtureFile } from "../mocks";

jest.mock("../../../src/translate/manager", () => {
    return {
        translateManager: {
            translate: jest.fn(),
            link: jest.fn(),
            opts: {
                to: 'en'
            }
        }
    }
});



describe("Marked", () => {

    test("Use flourite to determine whether text is programming code", async () => {
        (translateManager.translate as jest.Mock).mockResolvedValueOnce("你好，世界")

        const code = await getMarkdownTextValue('1. hello world');

        console.log(code);
    });

    test("Use marked to get the text value", async () => {

        let code = await getFixtureFile("live-share-public-preview.md");
        let tokens = marked.lexer(code);


        console.log(tokens);
    });




});


describe("Marked", () => {
    type TokenWithRange = marked.Token & {
        range: {
            start: { line: number, column: number },
            end: { line: number, column: number }
        };
    }

    function calculatePosition(markdown: string, index: number) {
        const lines = markdown.slice(0, index).split('\n');
        const line = lines.length - 1;
        const column = lines[line].length;
        return { line, column };
    }

    function lexerWithRange(markdown: string): { tokenRanges: TokenWithRange[], tokens: marked.Token[] } {
        const tokens = marked.lexer(markdown);
        let currentIndex = 0;


        const calculateTokens = (tokens: marked.Token[]): TokenWithRange[] => {
            return tokens.map(token => {
                let tokenRange: TokenWithRange = token as TokenWithRange;
                const tokenLength = token.raw.length;
                const startPosition = calculatePosition(markdown, currentIndex);
                const endPosition = calculatePosition(markdown, currentIndex + tokenLength);
                tokenRange.range = { start: startPosition, end: endPosition };
                currentIndex += tokenLength;

                // 递归处理子 tokens
                // @ts-ignore
                // if (token.tokens) {
                //     const parentIndex = currentIndex - tokenLength;
                //     // @ts-ignore
                //     tokenRange.tokens = calculateTokens(token.tokens);
                //     // 更新子 token 的 range
                //     // @ts-ignore
                //     tokenRange.tokens.forEach(subToken => {
                //         subToken.range.start.line += startPosition.line;
                //         subToken.range.start.column += startPosition.column;
                //         subToken.range.end.line += startPosition.line;
                //         subToken.range.end.column += startPosition.column;
                //     });
                // }

                return tokenRange;
            });
        };

        return { tokenRanges: calculateTokens(tokens), tokens };
    }

    it("Test lexerWithRange", async () => {
        // 示例用法


        let markdownText = await getFixtureFile("live-share-public-preview.md");

        const { tokenRanges, tokens } = lexerWithRange(markdownText);
        console.log(tokenRanges, tokens);
    });



});
