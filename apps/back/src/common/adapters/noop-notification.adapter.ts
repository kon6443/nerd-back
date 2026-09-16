import { Injectable, Logger } from '@nestjs/common';
import type { NotificationEvent, NotificationPort } from '../port/notification.port';

/**
 * 알림 채널이 설정되지 않았을 때 쓰는 구현.
 *
 * 로컬 개발·테스트의 **기본값**이다. `DISCORD_WEBHOOK_URL` 이 없으면 이것이 선택된다.
 *
 * 🚫 조용히 버리지 않고 `debug` 로 남긴다 — "왜 알림이 안 오지" 를 추적할 수 있어야 한다.
 *    ⚠️ `warn` 이 아니라 `debug` 인 이유: 미설정은 로컬에서 **정상 상태**다. `warn` 으로 두면
 *    개발할 때마다 경고가 쌓여 진짜 경고가 묻힌다.
 */
@Injectable()
export class NoopNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(NoopNotificationAdapter.name);

  notify(event: NotificationEvent): void {
    this.logger.debug(`알림 채널 미설정 — 전송 생략: [${event.severity}] ${event.title}`);
  }
}
