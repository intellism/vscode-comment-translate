import { LanguageIdentifier, loadModule } from 'cld3-asm';



// import { isCodeByFlourite } from "../../../src/util/string";
function isCodeByFlourite(text: string) {
    const flourite = require('flourite/dist/index.cjs');
    return flourite(text);
}
describe("Utils", () => {

    test("Use flourite to determine whether text is programming code", async () => {
        const code = isCodeByFlourite('hello world');
        expect(code.language).toBe('Unknown'); // 假设 'hello world' 不是代码
    });

    test("Use flourite to determine whether text is programming code", async () => {
        const code = isCodeByFlourite('const x = 10;');
        expect(code.language).not.toBe('Unknown'); // 假设 'const x = 10;' 是代码
    });


    test("Use flourite to determine whether text is programming code", async () => {
        const code = isCodeByFlourite(`
  这是做什么的
  const clientResToViewModel: (
    dto: DataResponseBase<ChannelTopModal>,
  ) => ChannelTopViewModel = (dto) => {
    return {
      success: true,
      data: get(dto, 'data.lowPriceCar'),
    };
  };
      `);
        expect(code.language).not.toBe('Unknown'); // 假设 'const x = 10;' 是代码
    });

});

describe("detectLanguage", () => {
    let identifier: LanguageIdentifier;

    beforeAll(async () => {
        if (!identifier) {
            let CldFactory = await loadModule();
            identifier = CldFactory.create(0, 1000);
        }
    });

    let text = '这是什么呢';

    test("Detect language by findMostFrequentLanguages", async () => {
        const arr = identifier.findMostFrequentLanguages(text, 2);
        expect(arr[0].language).toBe('zh');
    });

    test("Detect language by findLanguage", async () => {
        const result = identifier.findLanguage(text);
        expect(result.language).toBe('zh');
    });

});
