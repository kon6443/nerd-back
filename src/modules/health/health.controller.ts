import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@common/redis/redis.module';

@ApiTags('health')
@Controller('health')
// 헬스체크는 10~30초 간격으로 폴링된다. 레이트리밋 대상에 넣으면 자기 자신이 막힌다.
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
    description: 'Swarm healthcheck 와 리버스 프록시가 이 경로를 본다. 외부 의존을 검사하지 않는다.',
  })
  liveness() {
    return this.health.check([]);
  }

  /**
   * readiness — 외부 의존까지 확인한다. 진단·수동 확인용.
   * 하나라도 down 이면 503 을 반환한다.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'readiness — 외부 의존 확인',
    description: 'Redis 등 부가 의존을 검사한다. 배포 판정에는 쓰지 않는다.',
  })
  readiness() {
    return this.health.check([() => this.checkRedis()]);
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
}
