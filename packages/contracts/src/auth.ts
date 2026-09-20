import { z } from 'zod';
import { GUEST_LOGIN_ID_PREFIX } from './feature-flags';

/**
 * 로그인·가입 계약.
 *
 * 09-04 결정: **아이디와 비밀번호만** 받는다. 이름 등 부가 정보를 받지 않는다 —
 * 안 받은 개인정보는 유출될 수 없다.
 *
 * 09-20 결정: 사용자에게는 이것을 **「닉네임」** 으로 부른다. 「회원가입」 이라는 말이 주는
 * 부담을 걷어내되 **필드명(`loginId`)·DB·세션은 한 줄도 바꾸지 않는다** — 바뀌는 것은 호칭뿐이다.
 *
 * 이 스키마 하나를 프론트 폼 검증과 백엔드 입력 검증이 **같이** 쓴다.
 * "프론트는 통과했는데 백엔드가 400" 이 구조적으로 생기지 않는다.
 */

/** 닉네임 길이. 프론트 힌트 문구가 이 상수를 읽어 **규칙과 안내가 어긋날 수 없게** 한다. */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

/**
 * 한글·영문 소문자·숫자·밑줄.
 *
 * ⚠️ 한글을 허용하는 이상 **하한이 4자면 안 된다.** 「민수」 같은 두 글자 이름이 전부 막혀
 * "닉네임" 이라는 표기와 정면으로 모순되기 때문이다. 그래서 하한이 2자다.
 * 🚫 대문자는 계속 막는다 — DB collation 이 `utf8mb4_0900_ai_ci`(대소문자 무시)라
 *    `Kim` 으로 가입해도 `kim` 과 같은 계정이 되어 "가입한 대로 로그인이 안 된다" 로 드러난다.
 */
export const loginIdSchema = z
  .string()
  .min(NICKNAME_MIN_LENGTH, `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다.`)
  .max(NICKNAME_MAX_LENGTH, `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`)
  .regex(/^[a-z0-9가-힣_]+$/, '닉네임은 한글·영문 소문자·숫자·밑줄만 쓸 수 있습니다.');

/**
 * 상한(72자)이 있는 이유: 해시 함수에 임의 길이 입력을 그대로 넘기면 아주 긴 입력으로
 * CPU 를 태울 수 있다. 하한은 8자 — 시연용 서비스라 복잡도 규칙까지 걸지는 않는다.
 */
export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(72, '비밀번호는 72자 이하여야 합니다.');

/**
 * ⚠️ **사람은 게스트 접두사를 쓸 수 없다.**
 *
 * 막지 않으면 누구나 `guest_...` 로 가입할 수 있고, 그 계정은 화면에서 게스트로 오인되어
 * 「로그아웃하면 다시 들어올 수 없다」 는 **거짓 경고**를 보게 된다 — 실제로는 비밀번호를
 * 알고 있어 재로그인이 된다.
 *
 * 🚫 `loginIdSchema` 자체에 넣지 않는다. 그 스키마는 **서버가 만든 게스트 닉네임도 통과해야**
 *    하기 때문이다(`auth.service.spec.ts` 가 고정). 제약은 **사람이 지나는 가입 경로에만** 건다.
 */
export const signupSchema = z
  .object({ loginId: loginIdSchema, password: passwordSchema })
  .strict()
  .refine((input) => !input.loginId.startsWith(GUEST_LOGIN_ID_PREFIX), {
    path: ['loginId'],
    message: `「${GUEST_LOGIN_ID_PREFIX}」 로 시작하는 닉네임은 쓸 수 없습니다.`,
  });

/**
 * ⚠️ 로그인은 **형식을 느슨하게** 받는다. 가입 규칙으로 검증하면 "형식이 틀렸다"는 응답이
 * 곧 "그런 아이디는 없다"는 신호가 되어 계정 존재 여부가 새어나간다. 존재 확인은 한 가지
 * 응답(`INVALID_CREDENTIALS`)으로만 답한다.
 */
export const loginSchema = z
  .object({ loginId: z.string().min(1), password: z.string().min(1) })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** `GET /me` 응답. 🚫 비밀번호 해시는 어떤 형태로도 나가지 않는다. */
export interface Me {
  loginId: string;
}
