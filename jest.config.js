// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
module.exports = {
    // We don't want any other mocks from other places impacting this.
    roots: [path.join(__dirname, 'test', 'non-extension')],
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },   
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node','wasm'],
    setupFiles: ['./test/setup.ts'],
    testMatch: [path.join(__dirname, 'test/non-extension/**/*.test.ts')],
    transformIgnorePatterns: [
        'node_modules/(?!(got)/)', // 允许 Jest 转换 got 模块
      ],
    // setupFilesAfterEnv: ['jest-mock-vscode'],
    collectCoverage: true,
};
