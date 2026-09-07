import { z } from 'zod';

/**
 * 로그인·가입 계약.
 *
 * 09-04 결정: **아이디와 비밀번호만** 받는다. 이름 등 부가 정보를 받지 않는다 —
 * 안 받은 개인정보는 유출될 수 없다.
 *
 * 이 스키마 하나를 프론트 폼 검증과 백엔드 입력 검증이 **같이** 쓴다.
 * "프론트는 통과했는데 백엔드가 400" 이 구조적으로 생기지 않는다.
 */

/** 소문자·숫자·밑줄. 대소문자를 섞지 않아 "아이디가 안 되는데요" 문의를 줄인다. */
export const loginIdSchema = z
  .string()
  .min(4, '아이디는 4자 이상이어야 합니다.')
  .max(20, '아이디는 20자 이하여야 합니다.')
  .regex(/^[a-z0-9_]+$/, '아이디는 영문 소문자·숫자·밑줄만 쓸 수 있습니다.');

/**
 * 상한(72자)이 있는 이유: 해시 함수에 임의 길이 입력을 그대로 넘기면 아주 긴 입력으로
 * CPU 를 태울 수 있다. 하한은 8자 — 시연용 서비스라 복잡도 규칙까지 걸지는 않는다.
 */
export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(72, '비밀번호는 72자 이하여야 합니다.');

export const signupSchema = z
  .object({ loginId: loginIdSchema, password: passwordSchema })
  .strict();

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
