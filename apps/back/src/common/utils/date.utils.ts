/**
 * 날짜·시간 헬퍼.
 *
 * ## 정책: UTC 저장, 표시 시점에만 변환
 *
 * - 저장·비교·연산은 **전부 UTC**. DB 컬럼도 UTC.
 * - API 응답은 **ISO 8601 (Z suffix)**. 오프셋을 붙여 보내지 않는다 — 받는 쪽이 변환한다.
 * - 사람이 읽는 문자열이 필요한 순간에만 **타임존을 명시해서** 변환한다.
 *
 * ## 왜 이 파일만 쓰는가
 *
 * `getHours()`, `toLocaleString()` 같은 메서드는 **실행 환경의 로컬 타임존**을 따른다.
 * 개발자 노트북(KST), CI 러너(UTC), 컨테이너(UTC)가 서로 다른 답을 내므로
 * "로컬에서만 깨지는" 종류의 버그가 생긴다. eslint `no-restricted-syntax` 가
 * 그 메서드들을 error 로 막고 있고, 이 파일이 유일한 예외다.
 */

export const UTC = 'UTC';
export const KST = 'Asia/Seoul';

/** 현재 시각. 저장·비교에 쓴다. */
export function nowUtc(): Date {
  return new Date();
}

/** API 응답·로그용 ISO 8601 문자열 (UTC, `2026-08-26T10:00:00.000Z`). */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}

/**
 * 지정 타임존 기준 날짜 키 (`YYYY-MM-DD`).
 *
 * 일별 집계·카운터 키에 쓴다. **"오늘"의 정의가 어느 타임존이냐가 집계 결과를 바꾸므로**
 * 타임존을 인자로 강제한다. 예: 일별 API 예산 카운터는 KST 기준으로 리셋해야
 * 한국 사용자의 하루와 맞는다.
 */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * 사람이 읽는 문자열. 타임존을 반드시 넘긴다.
 *
 * 로케일을 `ko-KR` 로 고정하는 이유는 실행 환경의 기본 로케일에 따라 출력이
 * 달라지지 않게 하기 위해서다.
 */
export function formatInTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
}

/** 초 단위 경과 시간. 외부 API 호출 계측 등에 쓴다. */
export function elapsedMs(startedAt: Date, endedAt: Date = nowUtc()): number {
  return endedAt.getTime() - startedAt.getTime();
}
