module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  collectCoverage: true,
  testMatch: [
    "<rootDir>/test/**/*-test.ts",
  ],
};
