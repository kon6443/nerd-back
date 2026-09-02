import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { SKIP_ALL_THROTTLERS } from '@common/constants/throttle.constants';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import { withTimeout } from '@common/utils/with-timeout';

/** DB 핑 제한. 풀이 커넥션을 못 얻으면 mysql2 는 오래 기다릴 수 있다 — readiness 가 매달리지 않게 한다. */
const DB_PING_TIMEOUT_MS = 1_500;

@ApiTags('health')
@Controller('health')
// 헬스체크는 10~30초 간격으로 폴링된다. 레이트리밋 대상에 넣으면 자기 자신이 막히고,
// Redis 가 죽었을 때 폴링마다 fail-open 경고 로그가 쌓여 공유 로그 스택을 먹는다.
// ⚠️ 인자 없는 @SkipThrottle() 은 동작하지 않는다 — SKIP_ALL_THROTTLERS 주석 참조.
@SkipThrottle(SKIP_ALL_THROTTLERS)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * liveness — 프로세스가 살아 있는지만 본다.
   *
   * 🚫 **외부 의존을 검사하지 않는다.** Swarm healthcheck 와 리버스 프록시가 이 경로를 보므로,
   * 여기에 Redis·DB 를 넣으면 그쪽 장애가 컨테이너를 unhealthy 로 만들어 재시작 루프에 빠지고
   * 롤링 업데이트가 롤백된다. 앱은 멀쩡한데 배포가 막히는 경로다.
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'liveness — 프로세스 생존 확인',
    description:
      'Swarm healthcheck 와 리버스 프록시가 이 경로를 본다. 외부 의존을 검사하지 않는다.',
  })
  liveness() {
    return this.health.check([]);
  }

  /**
   * readiness — 외부 의존(Redis·DB)까지 확인한다. 진단·수동 확인용.
   * 하나라도 down 이면 503 을 반환한다. liveness 와 **합치지 않는다** — 합치면 DB 재시작 30초에
   * 앱 3개가 unhealthy 로 재시작되고, 배포 중이면 롤백된다.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'readiness — 외부 의존 확인',
    description: 'Redis·DB 를 검사한다. 배포 판정에는 쓰지 않는다.',
  })
  readiness() {
    return this.health.check([() => this.checkRedis(), () => this.checkDb()]);
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const session = this.indicator.check('redis');
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG'
        ? session.up()
        : session.down({ message: `예상치 못한 응답: ${pong}` });
    } catch (error) {
      return session.down({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async checkDb(): Promise<HealthIndicatorResult> {
    const session = this.indicator.check('db');
    try {
      await withTimeout(this.dataSource.query('SELECT 1'), DB_PING_TIMEOUT_MS, 'DB 핑');
      return session.up();
    } catch (error) {
      return session.down({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
