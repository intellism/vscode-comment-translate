// const flourrite = require('flourite');

import { isCodeByFlourite } from "../../../src/util/string";

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