
jest.mock("../../../src/configuration", () => {
  return {
    getConfig: jest.fn(),
  };
});

import {translateManager} from '../../../src/extension';
import { Comment } from "../../../src/syntax/Comment";
import { Uri } from "vscode";
import { createTextDocument } from "jest-mock-vscode";
import { codeData } from "../../fixtures/codes";
import { compileBlock } from "../../../src/languageFeature/compile";
import { getConfig } from '../../../src/configuration';
import {  mockTextMateService } from '../mocks';


jest.mock("../../../src/extension", ()=>{
  return {
    translateManager: {
      translate: jest.fn(),
      link: jest.fn()
    }
}
});

let ignoreConfig = [
  {
    "languageId": "javascript,typescript,javascriptreact,typescriptreact",
    "regular": "[\\*\\s]+"
  },
  {
    "languageId": "dart",
    "regular": "[\\s|/]+"
  },
  {
    "languageId": "rust",
    "regular": "[\\s|/]+"
  }
];


describe("Comment", () => {
  let comment: Comment;
  beforeAll(async () => {
    let textMateService = await mockTextMateService();
    comment = new Comment(textMateService);
  });

  test.each(codeData)("Documents should be compiled comment correctly:【$name】", async (item) => {
    let uri = Uri.file(item.name);
    let curr_doc = createTextDocument(uri, item.code, item.languageId);
    let blocks = await comment.getAllComment(curr_doc, "comment");

    (getConfig as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case "multiLineMerge":
          return item.multiLineMerge;
        case "ignore":
          return ignoreConfig;
        default:
          return;
      }
    });

    expect(blocks).toMatchSnapshot();
    // 注释翻译区域，需要同实际翻译内容区域一致。确定拆分块正常
    expect(blocks?.length).toEqual(item.translated.length);

    if (blocks && blocks.length > 0) {
      let blocksTasks = blocks.map(async (block, index) => {
        (translateManager.translate as jest.Mock).mockResolvedValueOnce(item.translated[index]);
        let res = await compileBlock(block, item.languageId);
        expect(res).toMatchSnapshot();
      });

      await Promise.all(blocksTasks);
    }

  });
});
