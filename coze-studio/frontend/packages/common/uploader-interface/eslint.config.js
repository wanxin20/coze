const { defineConfig } = require('@coze-arch/eslint-config');

module.exports = defineConfig({
  packageRoot: __dirname,
  preset: 'node',
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/naming-convention': 'off',
  },
});
