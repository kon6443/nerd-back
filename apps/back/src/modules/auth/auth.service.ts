import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { LoginInput, SignupInput } from '@nerd/contracts';
import { Repository } from 'typeorm';
import { User } from '@entities/user.entity';
import { InvalidCredentialsErrorResponseDto, LoginIdTakenErrorResponseDto } from './dto/auth.error.dto';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

/** MySQL 중복 키. TypeORM 이 드라이버 오류를 감싸므로 안쪽을 본다. */
const MYSQL_DUPLICATE_ENTRY = 1062;

function isDuplicateKey(error: unknown): boolean {
  const driver = (error as { driverError?: { errno?: number; code?: string } }).driverError;
  return driver?.errno === MYSQL_DUPLICATE_ENTRY || driver?.code === 'ER_DUP_ENTRY';
}

/**
 * 존재하지 않는 아이디로 로그인해도 **해시 검증을 실제로 수행**하기 위한 더미.
 *
 * ⚠️ 없으면 "아이디가 없을 때만 응답이 빠른" 타이밍 오라클이 생겨, 응답 코드를 하나로
 * 통일한 의미가 사라진다. 형식이 올바라야 KDF 가 실제로 돌므로 유효한 모양을 쓴다.
 */
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * 가입 후 바로 로그인 상태로 만든다. 쿠키에 담을 세션 값을 돌려준다.
   *
   * ⭐ **되돌림이 필요 없다.** 세션이 서명 쿠키라 발급이 실패할 수 없기 때문이다.
   * 서버측 세션이던 때에는 계정(MySQL) 저장 후 세션(Redis) 생성이 실패하면 **계정만 남고
   * 호출자는 실패를 봤고**, 재시도하면 409 라 빠져나갈 길이 없었다 (2026-09-07 실측).
   * 🚫 서버측 세션으로 돌아가면 그 보상 삭제도 함께 되살려야 한다.
   */
  async signup(input: SignupInput): Promise<string> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const saved = await this.users.save({ loginId: input.loginId, passwordHash });
      return this.sessions.issue(saved.id);
    } catch (error) {
      // 🚫 "먼저 조회해서 없으면 저장" 으로 막지 않는다. 동시 요청 둘이 모두 "없음" 을 보고
      //    통과하므로 **DB 의 UNIQUE 제약이 최종 방어선**이고, 그 위반을 409 로 옮긴다.
      if (isDuplicateKey(error)) {
        throw new LoginIdTakenErrorResponseDto();
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<string> {
    // `passwordHash` 는 엔티티에서 select: false 라 **명시적으로 요청**해야 온다.
    const user = await this.users.findOne({
      where: { loginId: input.loginId },
      select: { id: true, passwordHash: true },
    });

    // ⚠️ 사용자가 없어도 검증을 **건너뛰지 않는다** (↑ DUMMY_HASH 주석).
    const matched = await this.passwords.verify(input.password, user?.passwordHash ?? DUMMY_HASH);

    // 🚫 "아이디 없음" 과 "비밀번호 틀림" 을 구분하지 않는다. 구분하면 그 차이가 곧
    //    계정 존재 여부다.
    if (!user || !matched) {
      throw new InvalidCredentialsErrorResponseDto();
    }

    return this.sessions.issue(user.id);
  }

  // 🚫 logout 이 없다. 서버측 세션 상태가 없어 지울 것이 없다 — 컨트롤러가 쿠키만 지운다.
}
