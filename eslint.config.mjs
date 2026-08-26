import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    // 린트 대상에서 제외. 테스트 코드는 여기 넣지 않는다 —
    // 프로덕션 코드와 같은 품질 기준을 적용한다.
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    rules: {
      // CLAUDE.md Never 표의 "타입 억제 금지"를 도구로 강제한다.
      // 문서에 선언만 두면 지켜지지 않는다. 불가피한 경우에만
      // eslint-disable-next-line + 사유 주석을 남긴다.
      '@typescript-eslint/no-explicit-any': 'error',

      // await 누락과 잘못된 async 사용을 차단한다. NestJS 에서 가장 흔한 버그원이다.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // 완화
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
);
