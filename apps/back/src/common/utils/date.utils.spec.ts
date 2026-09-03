import { KST, UTC, dateKeyInTimeZone, elapsedMs, formatInTimeZone, toIsoUtc } from './date.utils';

// 2026-08-26 15:30 UTC = 2026-08-27 00:30 KST — 날짜가 넘어가는 시각
const CROSSES_MIDNIGHT_KST = new Date('2026-08-26T15:30:00.000Z');

describe('date.utils', () => {
  describe('toIsoUtc', () => {
    it('Z suffix 를 붙인 ISO 8601 을 만든다', () => {
      expect(toIsoUtc(CROSSES_MIDNIGHT_KST)).toBe('2026-08-26T15:30:00.000Z');
    });
  });

  describe('dateKeyInTimeZone', () => {
    it('UTC 기준 날짜 키를 만든다', () => {
      expect(dateKeyInTimeZone(CROSSES_MIDNIGHT_KST, UTC)).toBe('2026-08-26');
    });

    it('KST 기준으로는 다음 날이 된다 ⭐', () => {
      // 이게 타임존을 인자로 강제하는 이유다. "오늘"의 정의가 집계 결과를 바꾼다.
      expect(dateKeyInTimeZone(CROSSES_MIDNIGHT_KST, KST)).toBe('2026-08-27');
    });

    it('자리수를 항상 2자리로 채운다', () => {
      expect(dateKeyInTimeZone(new Date('2026-01-05T00:00:00.000Z'), UTC)).toBe('2026-01-05');
    });
  });

  describe('formatInTimeZone', () => {
    it('타임존에 따라 다른 결과를 낸다', () => {
      const inUtc = formatInTimeZone(CROSSES_MIDNIGHT_KST, UTC);
      const inKst = formatInTimeZone(CROSSES_MIDNIGHT_KST, KST);

      expect(inUtc).not.toBe(inKst);
      expect(inUtc).toContain('15:30');
      expect(inKst).toContain('00:30');
    });

    it('옵션으로 형식을 덮어쓸 수 있다', () => {
      const result = formatInTimeZone(CROSSES_MIDNIGHT_KST, KST, {
        hour: undefined,
        minute: undefined,
      });

      expect(result).not.toContain('00:30');
    });
  });

  describe('elapsedMs', () => {
    it('두 시각의 밀리초 차이를 낸다', () => {
      const start = new Date('2026-08-26T00:00:00.000Z');
      const end = new Date('2026-08-26T00:00:01.500Z');

      expect(elapsedMs(start, end)).toBe(1500);
    });
  });
});
