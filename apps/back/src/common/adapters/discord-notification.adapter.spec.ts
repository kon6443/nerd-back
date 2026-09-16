import type { Redis } from 'ioredis';
import { DiscordNotificationAdapter } from './discord-notification.adapter';
import type { NotificationEvent } from '../port/notification.port';

/**
 * Discord 알림 어댑터.
 *
 * 고정하려는 계약은 셋이다 — **도메인을 막지 않는다 / 개인정보·본문을 흘리지 않는다 /
 * 레플리카 3개에서 한 번만 나간다**.
 */
describe('DiscordNotificationAdapter', () => {
  const WEBHOOK_URL = 'https://discord.com/api/webhooks/000/test-token';
  let fetchMock: jest.SpyInstance;
  let redis: { set: jest.Mock };

  /** 전송된 body 를 파싱해 돌려준다. */
  const sentBody = () =>
    JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as {
      embeds: Array<Record<string, unknown>>;
    };

  const okFetch = () =>
    (fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 204 } as unknown as Response));

  /** 비동기 전송(fire-and-forget)이 끝나기를 기다린다. */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const makeAdapter = () =>
    new DiscordNotificationAdapter(WEBHOOK_URL, redis as unknown as Redis);

  const event: NotificationEvent = {
    severity: 'critical',
    title: '크레딧 부족',
    summary: '충전이 필요합니다.',
    context: { 상태코드: 402 },
  };

  beforeEach(() => {
    // 기본은 "내가 먼저 집었다" — dedupe 를 통과시킨다.
    redis = { set: jest.fn().mockResolvedValue('OK') };
    okFetch();
  });

  describe('페이로드', () => {
    it('embeds 하나를 담아 보낸다', async () => {
      makeAdapter().notify(event);
      await flush();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(WEBHOOK_URL);
      expect(init.method).toBe('POST');

      const body = sentBody();
      // 🚫 빈 배열이면 Discord 가 400 을 낸다. 항상 1개여야 한다.
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].description).toBe('충전이 필요합니다.');
      expect(body.embeds[0].title).toContain('크레딧 부족');
    });

    it('context 를 Embed 필드로 옮긴다', async () => {
      makeAdapter().notify(event);
      await flush();

      expect(sentBody().embeds[0].fields).toEqual([
        { name: '상태코드', value: '402', inline: true },
      ]);
    });

    it('context 가 없으면 fields 키 자체를 넣지 않는다', async () => {
      makeAdapter().notify({ severity: 'info', title: 't', summary: 's' });
      await flush();

      expect(sentBody().embeds[0]).not.toHaveProperty('fields');
    });

    // ⭐ 알림은 **외부 서비스**로 나간다. 채널 권한이 곧 접근 통제가 되므로
    //    호출측이 넘기지 않은 값이 어댑터에서 덧붙지 않아야 한다.
    it('보낸 본문에 webhook URL 이나 토큰이 들어가지 않는다 ⭐', async () => {
      makeAdapter().notify(event);
      await flush();

      const raw = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
      expect(raw).not.toContain('test-token');
      expect(raw).not.toContain('webhooks');
    });

    it('요청에 타임아웃 시그널을 붙인다', async () => {
      makeAdapter().notify(event);
      await flush();

      expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('도메인을 막지 않는다', () => {
    // ⭐ 예외가 호출측으로 올라가면 Discord 장애가 동화 제작 실패로 번진다.
    it('전송이 실패해도 예외를 올리지 않는다 ⭐', async () => {
      fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('연결 끊김'));

      expect(() => makeAdapter().notify(event)).not.toThrow();
      await expect(flush()).resolves.toBeUndefined();
    });

    it('4xx/5xx 응답도 예외를 올리지 않는다', async () => {
      fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: false, status: 429 } as unknown as Response);

      expect(() => makeAdapter().notify(event)).not.toThrow();
      await expect(flush()).resolves.toBeUndefined();
    });

    it('notify 는 Promise 를 돌려주지 않는다 — 호출측이 기다릴 수 없어야 한다', () => {
      expect(makeAdapter().notify(event)).toBeUndefined();
    });
  });

  describe('레플리카 3개에서 한 번만 보낸다', () => {
    it('dedupeKey 가 있으면 Redis 로 먼저 자리를 잡는다', async () => {
      makeAdapter().notify({ ...event, dedupeKey: 'k', dedupeTtlSeconds: 30 });
      await flush();

      expect(redis.set).toHaveBeenCalledWith('notify:dedupe:k', '1', 'EX', 30, 'NX');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // ⭐ 이게 깨지면 같은 사건으로 알림이 3번 간다(레플리카 수만큼).
    it('다른 레플리카가 이미 보냈으면 전송하지 않는다 ⭐', async () => {
      redis.set.mockResolvedValue(null); // NX 실패 = 키가 이미 있다

      makeAdapter().notify({ ...event, dedupeKey: 'k' });
      await flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    // ⭐ 장애 알림이 Redis 장애 때문에 사라지는 것이 최악이다. 중복 3건 < 유실 1건.
    it('Redis 가 죽으면 그래도 보낸다 (fail-open) ⭐', async () => {
      redis.set.mockRejectedValue(new Error('Redis 끊김'));

      makeAdapter().notify({ ...event, dedupeKey: 'k' });
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('dedupeKey 가 없으면 Redis 를 거치지 않는다', async () => {
      makeAdapter().notify(event);
      await flush();

      expect(redis.set).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
