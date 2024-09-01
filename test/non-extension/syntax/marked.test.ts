
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
