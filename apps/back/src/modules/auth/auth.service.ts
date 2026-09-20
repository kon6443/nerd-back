import { randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GUEST_LOGIN_ID_PREFIX, type LoginInput, type SignupInput } from '@nerd/contracts';
import { Repository } from 'typeorm';
import { AppEnv } from '@config/env.validation';
import { User } from '@entities/user.entity';
import { determineGuestAccessEnabled, determineSignupEnabled } from './auth.constants';
import {
  GuestAccessDisabledErrorResponseDto,
  InvalidCredentialsErrorResponseDto,
  LoginIdTakenErrorResponseDto,
  SignupDisabledErrorResponseDto,
} from './dto/auth.error.dto';
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

/**
 * 게스트 닉네임 구성. `guest_` + 소문자·숫자 10자 = 16자로, 닉네임 규칙(2~20자) 안에 들어온다.
 *
 * 🚫 사람이 고른 닉네임과 섞이지 않게 접두사를 `@nerd/contracts` 가 소유한다 — 프론트가
 *    "이건 게스트다" 를 판별해야 할 때 같은 값을 본다.
 */
const GUEST_LOGIN_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const GUEST_LOGIN_ID_SUFFIX_LENGTH = 10;

/**
 * 닉네임 충돌 시 재시도 횟수.
 *
 * 36^10 ≈ 3.6조이므로 현실적으로 1회로 끝난다. 그럼에도 재시도를 두는 이유는 **충돌이
 * 사용자에게 500 으로 보이지 않게** 하기 위해서다 — 게스트는 다시 누를 이유를 모른다.
 */
const GUEST_LOGIN_ID_ATTEMPTS = 3;

/** 게스트 비밀번호 바이트 수. 아무도(서버조차) 기억하지 않는다 — 인증은 세션 쿠키가 한다. */
const GUEST_PASSWORD_BYTES = 24;

function generateGuestLoginId(): string {
  let suffix = '';
  for (let i = 0; i < GUEST_LOGIN_ID_SUFFIX_LENGTH; i += 1) {
    suffix += GUEST_LOGIN_ID_ALPHABET[randomInt(GUEST_LOGIN_ID_ALPHABET.length)];
  }
  return `${GUEST_LOGIN_ID_PREFIX}${suffix}`;
}

export type UserCleanupHandler = (userId: number) => Promise<void>;

@Injectable()
export class AuthService {
  private readonly cleanupHandlers: UserCleanupHandler[] = [];

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 회원 탈퇴 시 실행할 데이터 정리 핸들러를 등록한다.
   * 도메인 모듈(StorySessionModule 등)이 AuthModule에 의존하면서 탈퇴 훅을 등록할 수 있게 하여
   * 모듈 간 순환 참조와 불필요한 결합을 방지한다.
   */
  registerCleanupHandler(handler: UserCleanupHandler): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * 환경 및 설정을 바탕으로 현재 회원가입이 허용되는지 확인한다.
   */
  isSignupAllowed(): boolean {
    const appEnv = this.config.get<AppEnv>('ENV') || AppEnv.LOCAL;
    const envOverride = this.config.get<string>('SIGNUP_ENABLED');
    return determineSignupEnabled(appEnv, envOverride);
  }

  /**
   * 게스트 체험 허용 여부. 기본값은 contracts 상수, 환경변수가 있으면 그쪽이 이긴다.
   */
  isGuestAccessAllowed(): boolean {
    return determineGuestAccessEnabled(this.config.get<string>('GUEST_ACCESS_ENABLED'));
  }

  /**
   * **입력 없이** 계정을 만들어 바로 로그인 상태로 만든다 (대회 심사·투표 대응).
   *
   * ⭐ 인증의 어느 부분도 새로 만들지 않는다. 같은 `users` 테이블, 같은 scrypt 해시,
   * 같은 서명 쿠키를 쓰고 **닉네임과 비밀번호를 사람 대신 서버가 채울 뿐**이다.
   * 그래서 가드·세션·탈퇴 정리 같은 기존 경로가 게스트에게도 그대로 적용된다.
   *
   * ⚠️ 생성된 비밀번호는 **어디에도 남지 않는다.** 해시만 저장하고 원문은 버린다 —
   * 게스트가 로그아웃하면 그 계정으로 다시 들어올 수 없다는 뜻이고, 그것이 의도다.
   * 🚫 이 값을 로그에 남기지 말 것.
   */
  async createGuest(): Promise<{ sid: string; loginId: string }> {
    if (!this.isGuestAccessAllowed()) {
      throw new GuestAccessDisabledErrorResponseDto();
    }

    const passwordHash = await this.passwords.hash(
      randomBytes(GUEST_PASSWORD_BYTES).toString('base64url'),
    );

    for (let attempt = 1; attempt <= GUEST_LOGIN_ID_ATTEMPTS; attempt += 1) {
      const loginId = generateGuestLoginId();
      try {
        const saved = await this.users.save({ loginId, passwordHash });
        return { sid: this.sessions.issue(saved.id), loginId };
      } catch (error) {
        // 🚫 마지막 시도의 충돌까지 삼키지 않는다. 계속 충돌한다면 난수가 고장난 것이고,
        //    그건 조용히 재시도할 일이 아니라 드러나야 할 장애다.
        if (isDuplicateKey(error) && attempt < GUEST_LOGIN_ID_ATTEMPTS) continue;
        throw error;
      }
    }

    // 위 루프는 반드시 반환하거나 던진다. 도달하지 않지만 반환 타입을 좁히기 위해 남긴다.
    throw new Error('게스트 닉네임 생성에 실패했다.');
  }

  /**
   * 가입 후 바로 로그인 상태로 만든다. 쿠키에 담을 세션 값을 돌려준다.
   *
   * ⭐ **되돌림이 필요 없다.** 세션이 서명 쿠키라 발급이 실패할 수 없기 때문이다.
   * 서버측 세션이던 때에는 계정(MySQL) 저장 후 세션(Redis) 생성이 실패하면 **계정만 남고
   * 호출자는 실패를 봤고**, 재시도하면 409 라 빠져나갈 길이 없었다 (2026-09-07 실측).
   * 🚫 서버측 세션으로 돌아가면 그 보상 삭제도 함께 되살려야 한다.
   */
  async signup(input: SignupInput): Promise<string> {
    if (!this.isSignupAllowed()) {
      throw new SignupDisabledErrorResponseDto();
    }

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

  /**
   * 회원 탈퇴: 사용자가 소유한 모든 세션의 개인 자산(임시 실사, 레퍼런스, 생성 삽화, 대화 음성)을
   * 삭제하고 계정을 삭제한다 (D10, 명세 5절).
   */
  async withdraw(userId: number): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;

    for (const handler of this.cleanupHandlers) {
      await handler(userId);
    }

    await this.users.delete({ id: userId });
  }
}
