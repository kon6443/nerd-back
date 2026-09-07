import { ApiProperty } from '@nestjs/swagger';
import type { Me } from '@nerd/contracts';

/**
 * ⚠️ Swagger 명세용 타입 선언 전용. `new` 로 만들어 반환하지 않는다.
 * `implements Me` 라 계약이 바뀌면 컴파일이 깨진다.
 *
 * 🚫 비밀번호 해시는 어떤 형태로도 나가지 않는다. 엔티티에서 `select: false` 이고
 * 이 DTO 에도 자리가 없다 — 두 겹으로 막는다.
 */
export class MeDto implements Me {
  @ApiProperty({ example: 'tester' })
  loginId: string;
}
