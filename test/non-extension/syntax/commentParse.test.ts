
jest.mock("../../../src/configuration", () => {
    return {
        getConfig: jest.fn(),
    };
});

import { CommentParse, isComment, ignoreComment, skipComment } from "../../../src/syntax/CommentParse";
import { TextMateService } from "../../../src/syntax/TextMateService";
import { Position, Uri } from "vscode";
import { createTextDocument } from "jest-mock-vscode";
import { getFixtureFile, mockTextMateService } from "../mocks";
import { getConfig } from "../../../src/configuration";
//   import { commentData } from "../../fixtures/comment";


describe("CommentParse TypeScript", () => {
    let textMateService: TextMateService;
    let commentParse: CommentParse;
    beforeAll(async () => {
        textMateService = await mockTextMateService();

        let code = await getFixtureFile("comment.ts");

        let item = {
            name: 'typescript comment',
            languageId: 'typescript',
            code,
        };

        let uri = Uri.file(item.name);
        let curr_doc = createTextDocument(uri, item.code, item.languageId);

        const grammar = await textMateService.createGrammar(item.languageId);
        if (grammar == null) return null;

        commentParse = new CommentParse(curr_doc, grammar);
    });

    test("Documents should be parsed string correctly:【typescript】", async () => {

        (getConfig as jest.Mock).mockImplementation((key: string) => {
            switch (key) {
                case "hover.string":
                    return true;
                default:
                    return;
            }
        });

        let res = commentParse.computeText(new Position(34, 16));
        expect(res?.comment).toEqual("'hello world'");
        expect(res?.tokens?.length).toEqual(1);
        expect(res?.tokens![0].ignoreStart).toEqual(1);
        expect(res?.tokens![0].ignoreEnd).toEqual(1);

        //  TODO 不支持字符串模板，中间变量很难处理
        //     res = commentParse.computeText(new Position(35, 16));
        //     expect(res?.comment).toEqual(`\`多行文本
        // Type Definition for \${text} Visual Studio Code 1.91 Extension API
        // See https://code.visualstudio.com/api for more information\``);
        //     expect(res?.tokens?.length).toEqual(3);
        //     expect(res?.tokens![0].ignoreStart).toEqual(1);
        //     expect(res?.tokens![2].ignoreEnd).toEqual(1);
    });

    test("Documents should be parsed comment correctly:【typescript】", async () => {

        let position = new Position(0, 1);
        let res = commentParse.commentScopeParse(position, isComment, false, {
            ignoreHandle: ignoreComment, skipHandle: skipComment
        });
        expect(res.comment).toEqual(`/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See https://github.com/microsoft/vscode/blob/main/LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/`);
        expect(res.tokens?.length).toEqual(5);


        position = new Position(7, 5);
        res = commentParse.commentScopeParse(position, isComment, false, {
            ignoreHandle: ignoreComment, skipHandle: skipComment
        });
        expect(res.comment).toEqual(`/**
 * Type Definition for Visual Studio Code 1.91 Extension API
 * See https://code.visualstudio.com/api for more information
 */`);
        expect(res.tokens?.length).toEqual(4);

        position = new Position(10, 0);
        res = commentParse.commentScopeParse(position, isComment, false, {
            ignoreHandle: ignoreComment, skipHandle: skipComment
        });
        expect(res.comment).toEqual(`export`);
        expect(res.tokens?.length).toEqual(1);

        position = new Position(11, 5);
        res = commentParse.commentScopeParse(position, isComment, false, {
            ignoreHandle: ignoreComment, skipHandle: skipComment
        });
        expect(res.comment).toEqual(`/**
   * Title of the command, like \`save\`.
   */`);
        expect(res.tokens?.length).toEqual(3);

    });
});

describe.skip("CommentParse XML", () => {
    let textMateService: TextMateService;
    let commentParse: CommentParse;
    beforeAll(async () => {
        textMateService = await mockTextMateService();

        let code = await getFixtureFile("background.xml");

        let item = {
            name: 'xml comment',
            languageId: 'xml',
            code,
        };

        let uri = Uri.file(item.name);
        let curr_doc = createTextDocument(uri, item.code, item.languageId);

        const grammar = await textMateService.createGrammar(item.languageId);
        if (grammar == null) return null;

        commentParse = new CommentParse(curr_doc, grammar);
    });

    test("Documents should be parsed string correctly:【xml】", async () => {

        (getConfig as jest.Mock).mockImplementation((key: string) => {
            switch (key) {
                case "hover.string":
                    return true;
                default:
                    return;
            }
        });

        let res = commentParse.computeText(new Position(9, 14));
        expect(res?.comment).toEqual('<!-- <item>\n        <bitmap\n            android:gravity="center"\n            android:src="@mipmap/launch_image" />\n    </item> -->');
    });

});
