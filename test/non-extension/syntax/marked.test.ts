
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


describe("HTML visibility in markdown", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        translateManager.opts.to = 'zh-CN';
    });

    afterEach(() => {
        translateManager.opts.to = 'en';
    });

    test("should translate markdown with invisible HTML comment", async () => {
        const input = `All other classes in this module are considered implementation details.  \n(Also note that HelpFormatter and RawDescriptionHelpFormatter are only  \nconsidered public as object names -- the API of the formatter objects is  \nstill considered an implementation detail.)\n<!--moduleHash:-1594644963-->`;

        (translateManager.translate as jest.Mock).mockResolvedValueOnce(
            "本模块中的所有其他类都被视为实现细节。\n（还要注意，HelpFormatter 和 RawDescriptionHelpFormatter 仅\n被视为公共对象名称——格式化程序对象的 API\n仍被视为实现细节。）"
        );

        const result = await getMarkdownTextValue(input);

        expect(result.hasTranslated).toBe(true);
        expect(translateManager.translate).toHaveBeenCalled();
    });

    test("should skip translation when HTML has visible content", async () => {
        const input = `Some text\n<div>visible content</div>`;

        const result = await getMarkdownTextValue(input);

        expect(result.hasTranslated).toBe(false);
        expect(result.result).toBe(input);
        expect(translateManager.translate).not.toHaveBeenCalled();
    });

    test("should translate markdown with only HTML comment tags like <!-- -->", async () => {
        const input = `Hello world\n<!-- this is a comment -->`;

        (translateManager.translate as jest.Mock).mockResolvedValueOnce("你好世界");

        const result = await getMarkdownTextValue(input);

        expect(result.hasTranslated).toBe(true);
        expect(translateManager.translate).toHaveBeenCalled();
    });

    test("should skip translation for self-closing HTML tags with attributes", async () => {
        const input = `Some text\n<img src="test.png" alt="test image"/>`;

        const result = await getMarkdownTextValue(input);

        expect(result.hasTranslated).toBe(false);
        expect(result.result).toBe(input);
    });

    test("should translate markdown with non-visible HTML tags like <br>, <hr>, <meta>", async () => {
        const input = `Hello world\n<br>\n<hr>`;

        (translateManager.translate as jest.Mock).mockResolvedValueOnce("你好世界");

        const result = await getMarkdownTextValue(input);

        expect(result.hasTranslated).toBe(true);
        expect(translateManager.translate).toHaveBeenCalled();
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
