import type { Redis } from 'ioredis';
import { ServerErrorRateMonitor } from './server-error-rate-monitor.service';
import type { NotificationPort } from '../port/notification.port';

describe('ServerErrorRateMonitor', () => {
  let redis: { incr: jest.Mock; expire: jest.Mock };
  let notifications: { notify: jest.Mock };
  let monitor: ServerErrorRateMonitor;

  /** 알림 중 특정 제목만 골라낸다 — 첫 발생과 급증이 같은 호출에서 함께 나갈 수 있다. */
  const sentWith = (title: string) =>
    notifications.notify.mock.calls.map(([e]) => e as { title: string }).filter((e) => e.title === title);

  beforeEach(() => {
    redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1) };
    notifications = { notify: jest.fn() };
    monitor = new ServerErrorRateMonitor(
      redis as unknown as Redis,
      notifications as NotificationPort,
    );
  });

  describe('새 서버 오류 (첫 발생)', () => {
    it('라우트 패턴을 키로 알린다', async () => {
      await monitor.record('POST /sessions/:id/pages');

      expect(sentWith('새 서버 오류')[0]).toMatchObject({
        severity: 'critical',
        context: { 경로: 'POST /sessions/:id/pages' },
        dedupeKey: 'server-error-first:POST /sessions/:id/pages',
      });
    });

    it('라우트를 모르면 첫 발생 알림은 보내지 않는다', async () => {
      await monitor.record(undefined);

      expect(sentWith('새 서버 오류')).toHaveLength(0);
    });
  });

  describe('서버 오류 급증', () => {
    // ⭐ `>=` 로 두면 임계치를 넘어선 뒤 **건건마다** 알림이 나가 채널이 덮인다.
    it('임계치에 도달한 그 건에서만 알린다 ⭐', async () => {
      redis.incr.mockResolvedValue(10);
      await monitor.record();
      expect(sentWith('서버 오류 급증')).toHaveLength(1);

      notifications.notify.mockClear();
      redis.incr.mockResolvedValue(11);
      await monitor.record();
      expect(sentWith('서버 오류 급증')).toHaveLength(0);
    });

    it('임계치 아래면 알리지 않는다', async () => {
      redis.incr.mockResolvedValue(9);
      await monitor.record();

      expect(sentWith('서버 오류 급증')).toHaveLength(0);
    });

    it('창의 첫 건에서만 만료를 건다', async () => {
      redis.incr.mockResolvedValue(1);
      await monitor.record();
      expect(redis.expire).toHaveBeenCalledTimes(1);

      redis.expire.mockClear();
      redis.incr.mockResolvedValue(2);
      await monitor.record();
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('같은 창에서는 같은 키를 쓴다', async () => {
      await monitor.record();
      await monitor.record();

      const [firstKey] = redis.incr.mock.calls[0] as [string];
      const [secondKey] = redis.incr.mock.calls[1] as [string];
      expect(firstKey).toBe(secondKey);
      expect(firstKey).toMatch(/^alert:5xx:\d+$/);
    });
  });

  // ⭐ 이 코드는 **에러 응답을 돌려주는 길목**에서 불린다. 여기서 던지면
  //    "에러 처리 중의 에러" 가 되어 원래 응답까지 망가진다.
  it('Redis 가 죽어도 던지지 않는다 ⭐', async () => {
    redis.incr.mockRejectedValue(new Error('Redis 끊김'));

    await expect(monitor.record('GET /x')).resolves.toBeUndefined();
  });

  it('경로에 실제 URL 이 아니라 패턴만 담긴다', async () => {
    await monitor.record('GET /sessions/:id');

    const sent = JSON.stringify(sentWith('새 서버 오류')[0]);
    // 패턴에는 `:id` 가 남아 있어야 하고, 실제 UUID 가 섞이면 안 된다.
    expect(sent).toContain(':id');
    expect(sent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
