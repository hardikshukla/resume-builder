/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    // Resolve @/ path alias to root
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    // isolatedModules (transpile-only, no type-check during tests) is read
    // from tsconfig.json; type errors are caught by `tsc --noEmit` instead.
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Relax for tests — no need for strict JSX transform
        jsx: 'react',
        module: 'commonjs',
      },
    }],
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
  ],
};

module.exports = config;
