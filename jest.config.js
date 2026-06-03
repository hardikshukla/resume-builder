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
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        // Relax for tests — no need for strict JSX transform
        jsx: 'react',
        module: 'commonjs',
      },
    }],
  },
  // Don't try to transform node_modules except these ESM-only packages
  transformIgnorePatterns: [
    'node_modules/(?!(node-fetch)/)',
  ],
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
  ],
};

module.exports = config;
