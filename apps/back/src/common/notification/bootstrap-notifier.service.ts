import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_PORT, type NotificationPort } from '../port/notification.port';

/**
 * 프로세스가 요청을 받을 준비가 됐을 때 한 번 알린다.
 *
 * ## 왜 필요한가
 * 배포가 **실제로 반영됐는지**는 워크플로가 초록불인 것만으로는 알 수 없다. 레플리카 3개가
 * 롤링으로 교체되므로 "몇 번이 언제 어떤 버전으로 떴는가" 가 배포 확인의 실체다.
 * 장애 추적에서도 출발점이 된다 — 문제가 시작된 시각과 재시작 시각을 맞춰 보게 된다.
 *
 * ## 중복 억제를 슬롯별로 거는 이유
 * 레플리카마다 자기 기동을 알려야 하므로 **키에 슬롯 번호를 넣는다.** 키를 공유하면
 * 첫 하나만 보고되어 "3개 중 2개만 떴다" 를 못 본다.
 * TTL 은 짧게(1분) 둔다 — 크래시 루프면 분당 1건으로 억제되면서도 **반복되고 있다는 사실은 보인다.**
 */
@Injectable()
export class BootstrapNotifier implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
  ) {}

  onApplicationBootstrap(): void {
    const slot = this.config.get<number>('TASK_SLOT') ?? 1;
    const env = this.config.get<string>('NODE_ENV') ?? 'development';
    // 배포 파이프라인이 커밋 SHA 를 태그로 쓴다. 로컬에는 없다.
    const version = this.config.get<string>('IMAGE_TAG');

    this.notifications.notify({
      severity: 'info',
      title: '백엔드 기동',
      summary: '요청을 받을 준비가 끝났습니다.',
      context: {
        환경: env,
        레플리카: `#${slot}`,
        ...(version ? { 버전: version } : {}),
      },
      // 슬롯별로 따로 센다 — 공유하면 "3개 중 하나만 떴다" 를 놓친다.
      dedupeKey: `boot:${env}:${slot}:${version ?? 'local'}`,
      dedupeTtlSeconds: 60,
    });
  }
}
