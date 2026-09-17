/**
 * 운영 알림 — 사람이 **지금 행동해야 하는 일**만 외부 채널로 내보낸다.
 *
 * 🚫 로그 대체재가 아니다. 모든 실패를 여기로 보내면 알림 피로가 와서 사람이 읽지 않게 되고,
 *    그러면 정작 중요한 알림을 놓친다. 판단 기준은 하나다 — **사람이 지금 할 일이 있는가.**
 */

/** 무엇을 얼마나 급하게 봐야 하는가. */
export type NotificationSeverity =
  /** 사람이 개입하지 않으면 기능이 복구되지 않는다 (예: 결제 필요). */
  | 'critical'
  /** 일부가 실패했고 반복되면 조치가 필요하다. */
  | 'warning'
  /** 알아 두면 좋은 상태 변화. */
  | 'info';

export interface NotificationEvent {
  severity: NotificationSeverity;
  /** 한 줄 제목. 채널 목록에서 이것만 보고 판단할 수 있어야 한다. */
  title: string;
  /** 무엇이 일어났고 다음에 무엇을 해야 하는지. */
  summary: string;
  /**
   * 부가 정보. Discord Embed 의 필드로 나간다.
   *
   * 🚫 **개인정보를 넣지 않는다** — `loginId`·얼굴 이미지 URL·세션 소유자 등.
   *    외부 서비스로 나가므로 채널 권한이 곧 접근 통제가 된다.
   * 🚫 **외부 API 요청·응답 본문을 넣지 않는다** (루트 `CLAUDE.md` Never).
   *    상태코드·소요시간·건수처럼 사람이 판단에 쓰는 값만 담는다.
   */
  context?: Record<string, string | number>;
  /**
   * 중복 억제 키.
   *
   * ⚠️ **레플리카가 3개다.** 같은 사건을 셋이 각각 감지하므로, 이 키가 없으면 알림이 3번 간다.
   * 같은 키는 `dedupeTtlSeconds` 동안 한 번만 나간다.
   */
  dedupeKey?: string;
  /** 기본 10분. 사건이 반복될 때 얼마나 조용히 둘지. */
  dedupeTtlSeconds?: number;
}

/**
 * 🚫 반환형이 `void` 다 — **fire-and-forget 을 타입에 박아 둔다.**
 *    호출측이 `await` 하게 두면 알림 채널의 지연이 도메인 API 의 지연이 된다.
 */
export interface NotificationPort {
  notify(event: NotificationEvent): void;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
