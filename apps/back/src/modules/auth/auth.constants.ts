import { GUEST_ACCESS_ENABLED } from '@nerd/contracts';
import { AppEnv } from '@config/env.validation';

/**
 * 환경별 회원가입 허용 여부 기본값 트리거 상수.
 *
 * - LOCAL: 로컬 개발 및 테스트 환경에서는 계정 생성 허용 (true)
 * - PROD: 2026-09-20 개방 — 대회 심사·투표 기간에 **환경변수 누락만으로** 심사위원이
 *   가입조차 못 하는 상황을 만들지 않기 위해 기본값을 열었다.
 *   (docs/tasks/tasks-low-friction-onboarding.md)
 *
 * 💡 차단이 필요하면 서버 환경변수 `SIGNUP_ENABLED=false` 를 주입한다 —
 *    킬 스위치는 그대로 살아 있고, 아래 판정 함수가 기본값보다 오버라이드를 우선한다.
 */
export const SIGNUP_ENABLED_BY_ENV: Record<AppEnv, boolean> = {
  [AppEnv.LOCAL]: true,
  [AppEnv.PROD]: true,
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

/**
 * 게스트 체험 허용 여부를 판정한다.
 *
 * 기본값은 `@nerd/contracts` 의 `GUEST_ACCESS_ENABLED` — **프론트 버튼이 보는 값과 같다.**
 * 한 곳을 고치면 두 앱이 함께 바뀐다는 것이 이 플래그의 핵심이다.
 *
 * 🚫 환경(LOCAL/PROD)별 기본값을 두지 않는다. 가입 플래그와 달리 이건 **제품 모드 선택**이라
 *    로컬과 배포가 다르게 동작하면 "로컬에선 되는데" 를 만든다.
 */
export function determineGuestAccessEnabled(envOverride?: string): boolean {
  if (envOverride === 'true') return true;
  if (envOverride === 'false') return false;
  return GUEST_ACCESS_ENABLED;
}
