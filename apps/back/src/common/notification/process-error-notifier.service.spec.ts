import { ProcessErrorNotifier } from './process-error-notifier.service';
import type { NotificationPort } from '../port/notification.port';

/**
 * ⚠️ 이 클래스는 `process` 전역에 리스너를 건다. 테스트가 서로 오염되지 않도록
 * 매 케이스에서 붙이고 떼는 것을 명시한다.
 */
describe('ProcessErrorNotifier', () => {
  let notifications: { notify: jest.Mock };
  let notifier: ProcessErrorNotifier;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    notifications = { notify: jest.fn() };
    notifier = new ProcessErrorNotifier(notifications as NotificationPort);
    // 🚫 진짜로 종료하면 테스트 러너가 죽는다.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    notifier.onApplicationBootstrap();
  });

  afterEach(() => {
    notifier.onApplicationShutdown();
    jest.useRealTimers();
    exitSpy.mockRestore();
  });

  it('처리되지 않은 Promise 거부를 critical 로 알린다', () => {
    process.emit('unhandledRejection', new TypeError('boom'), Promise.resolve());

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical', context: { 종류: 'TypeError' } }),
    );
  });

  // ⭐ 리스너를 등록하면 Node 의 기본 동작(종료)이 사라진다(Node 22 실측).
  //    그대로 두면 **상태가 깨진 프로세스가 계속 요청을 받는다.** 직접 끝내야 한다.
  it('잡히지 않은 예외는 유예 뒤 프로세스를 종료한다 ⭐', () => {
    process.emit('uncaughtException', new Error('fatal'));

    // 알림이 나갈 시간을 준 뒤에 끝낸다 — 즉시 죽이면 전송이 잘린다.
    expect(exitSpy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(3_000);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ⭐ 비동기 체인 하나가 끊긴 것으로 전체를 내리면 가용성이 더 나빠진다.
  it('Promise 거부만으로는 종료하지 않는다 ⭐', () => {
    process.emit('unhandledRejection', new Error('async'), Promise.resolve());

    jest.advanceTimersByTime(10_000);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('알림에 스택 트레이스를 담지 않는다 ⭐', () => {
    const error = new Error('내부 경로가 담긴 메시지');
    process.emit('uncaughtException', error);

    const sent = JSON.stringify(notifications.notify.mock.calls[0][0]);
    expect(sent).not.toContain('내부 경로가 담긴 메시지');
    expect(sent).not.toContain('at ');
  });

  it('종료 후 리스너를 떼어 다음 앱에서 중복 보고되지 않게 한다', () => {
    notifier.onApplicationShutdown();
    notifications.notify.mockClear();

    process.emit('unhandledRejection', new Error('after shutdown'), Promise.resolve());

    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
