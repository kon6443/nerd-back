import { AppEnv } from '@config/env.validation';

/**
 * 환경별 회원가입 허용 여부 기본값 트리거 상수.
 *
 * - LOCAL: 로컬 개발 및 테스트 환경에서는 계정 생성 허용 (true)
 * - PROD: 내부 테스트 기간 동안 불특정 외부 사용자의 신규 가입 차단 (false)
 *
 * 💡 추후 일반 사용자 대상 정식 오픈 시 PROD 값을 true 로 변경하거나,
 *    서버 환경변수(SIGNUP_ENABLED=true)를 주입하여 즉시 오픈할 수 있습니다.
 */
export const SIGNUP_ENABLED_BY_ENV: Record<AppEnv, boolean> = {
  [AppEnv.LOCAL]: true,
  [AppEnv.PROD]: false,
};

/**
 * 주어진 환경(ENV)과 환경변수 오버라이드(SIGNUP_ENABLED)를 바탕으로
 * 회원가입 허용 여부를 결정하는 판정 함수.
 */
export function determineSignupEnabled(
  env: AppEnv = AppEnv.LOCAL,
  envOverride?: string,
): boolean {
  if (envOverride === 'true') return true;
  if (envOverride === 'false') return false;
  return SIGNUP_ENABLED_BY_ENV[env] ?? true;
}
