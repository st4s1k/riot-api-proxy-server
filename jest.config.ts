import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "test/tsconfig.json",
      }
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testEnvironment: "miniflare",
  testEnvironmentOptions: {
    scriptPath: "src/worker.ts",
    modules: true,
    kvNamespaces: ["RATE_LIMIT_KV"],
  },
};

export default jestConfig;
