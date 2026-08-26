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

      // 로컬 타임존에 의존하는 Date 메서드를 막는다.
      // 개발자 노트북(KST)·CI 러너(UTC)·컨테이너(UTC)가 서로 다른 답을 내므로
      // "로컬에서만 깨지는" 버그가 생긴다. 규칙을 문서에 적어두면 지켜지지 않는다.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression > MemberExpression[property.name=/^(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds|getMilliseconds|setFullYear|setMonth|setDate|setHours|setMinutes|setSeconds|setMilliseconds|getTimezoneOffset|toLocaleString|toLocaleDateString|toLocaleTimeString)$/]',
          message:
            '로컬 타임존에 의존한다. @common/utils/date.utils 의 헬퍼를 쓰거나 getUTC*/toISOString 을 쓴다. 불가피하면 eslint-disable + 사유 주석.',
        },
      ],

      // 완화
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
  {
    // date.utils 는 위 메서드를 감싸는 곳이므로 예외다. 테스트는 고정 시각을 다루므로 허용한다.
    files: ['src/common/utils/date.utils.ts', '**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);
