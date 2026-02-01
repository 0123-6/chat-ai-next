import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // 👇 关闭这两个规则
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      // 👈 强制缩进为2个空格
      // indent: ['error', 2],
      // 禁止混用 space 和 tab
      'no-mixed-spaces-and-tabs': 'error',
      // 禁止使用 tab
      'no-tabs': 'error',
      // 👇 强制使用单引号
      quotes: ['error', 'single'],
      // 👇 禁止使用分号
      semi: ['error', 'never'],
      // 👇 对象/数组最后一个元素允许逗号（便于多行编辑）
      'comma-dangle': ['error', 'always-multiline'],
      // 👇 忽略以 _ 开头的变量和参数未使用警告
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
]);

export default eslintConfig;
