import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { NOTIFICATION_PORT, type NotificationPort } from '../port/notification.port';

/**
 * 종료 전에 알림이 나갈 유예.
 *
 * 알림은 fire-and-forget 이라 즉시 `exit` 하면 전송 중인 요청이 잘린다. 반대로 길게 두면
 * **상태가 깨진 프로세스가 그만큼 더 요청을 받는다.** webhook 전송은 보통 수백 ms 다.
 */
const EXIT_GRACE_MS = 3_000;

/**
 * 프로세스를 죽이거나 죽일 뻔한 예외를 알린다.
 *
 * ## 왜 이것이 「에러 알림」의 1순위인가
 * 개별 요청 에러는 사용자 한 명의 문제이고 로그로 충분하다. 그러나 `uncaughtException` 과
 * `unhandledRejection` 은 **프로세스 전체**의 문제다 — "다음 요청부터 이상해진다" 로 이어지는데
 * 그 인과가 로그에서는 잘 안 보인다.
 *
 * ## ⚠️ 핸들러를 등록하면 Node 의 기본 동작이 사라진다
 * 실측(Node 22): `uncaughtException` 리스너가 있으면 **프로세스가 종료되지 않는다.**
 * 즉 이 클래스를 만드는 것만으로 "예외 시 종료" 가 조용히 꺼진다. 그래서 두 이벤트의
 * 처리를 **의도적으로 다르게** 가져간다.
 *
 * | 이벤트 | 종료하나 | 왜 |
 * |---|---|---|
 * | `uncaughtException` | **한다** | 동기 스택이 끊긴 것이라 프로세스 상태를 믿을 수 없다. 레플리카 3개 + Swarm `restart_policy` 가 있으므로 죽는 편이 안전하다 |
 * | `unhandledRejection` | 하지 않는다 | 대개 비동기 체인 하나가 국소적으로 끊긴 것이다. 이것으로 전체를 내리면 가용성이 더 나빠진다 |
 *
 * 🚫 스택 트레이스를 알림에 담지 않는다 — 내부 경로·구조가 외부 채널로 나간다.
 *    **로그에 남기고, 알림은 "무엇이 어디서" 까지만** 말한다.
 */
@Injectable()
export class ProcessErrorNotifier implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProcessErrorNotifier.name);

  // 해제할 수 있도록 참조를 들고 있는다 — 앱을 여러 번 만드는 환경에서 리스너가 누적되면
  // 같은 사건이 여러 번 보고되고 `MaxListenersExceededWarning` 이 뜬다.
  private readonly onRejection = (reason: unknown): void => {
    this.logger.error(
      '처리되지 않은 Promise 거부',
      reason instanceof Error ? reason.stack : reason,
    );
    this.notify('처리되지 않은 Promise 거부', reason);
  };

  private readonly onException = (error: Error): void => {
    this.logger.error('잡히지 않은 예외', error.stack);
    this.notify('잡히지 않은 예외', error);

    // ⚠️ 위 클래스 주석 참조 — 이 리스너가 있는 한 Node 는 스스로 종료하지 않는다.
    //    깨진 상태로 계속 응답하는 것이 죽는 것보다 나쁘므로 직접 끝낸다.
    setTimeout(() => process.exit(1), EXIT_GRACE_MS);
  };

  constructor(@Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort) {}

  onApplicationBootstrap(): void {
    process.on('unhandledRejection', this.onRejection);
    process.on('uncaughtException', this.onException);
  }

  onApplicationShutdown(): void {
    process.off('unhandledRejection', this.onRejection);
    process.off('uncaughtException', this.onException);
  }

  private notify(title: string, cause: unknown): void {
    // 에러 종류(클래스명)까지만 담는다. 메시지 본문은 내부 정보를 품을 수 있다.
    const kind = cause instanceof Error ? cause.name : typeof cause;

    this.notifications.notify({
      severity: 'critical',
      title,
      summary: '프로세스 수준 오류입니다. 로그에서 스택을 확인하세요.',
      context: { 종류: kind },
      // 같은 버그가 연쇄로 터지면 채널이 덮인다. 10분 억제하되 종류별로 구분한다.
      dedupeKey: `process-error:${title}:${kind}`,
      dedupeTtlSeconds: 600,
    });
  }
}
