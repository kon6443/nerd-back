import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Me } from '@nerd/contracts';
import type { Response } from 'express';
import { SUCCESS_CODE } from '@common/constants/app.constants';
import { THROTTLE_LOGIN } from '@common/constants/throttle.constants';
import {
  ApiCommonInternalServerErrorResponse,
  ApiCommonThrottledResponse,
  ApiCommonUnauthorizedResponse,
  ApiCommonValidationResponse,
} from '@common/decorators/api-error-response.decorator';
import { ApiSuccessResponse } from '@common/decorators/api-success-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '@common/decorators/current-user.decorator';
import { ApiErrorBodyDto } from '@common/dto/api-error.dto';
import { AuthGuard } from '@common/guards/auth.guard';
import { AppEnv } from '@config/env.validation';
import type { User } from '@entities/user.entity';
import { AuthService } from './auth.service';
import { LoginRequestDto, SignupRequestDto } from './dto/auth-request.dto';
import { MeDto } from './dto/auth-response.dto';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 세션 쿠키를 심는다.
   *
   * - `httpOnly` — 🚫 빼지 말 것. JS 가 읽을 수 있으면 XSS 하나로 세션이 통째로 털린다.
   * - `sameSite: 'lax'` — 같은 도메인에서 프론트·백이 함께 서므로 CSRF 표면이 좁다.
   * - `secure` — 배포는 HTTPS 이므로 켜고, 로컬 http 에서는 꺼야 쿠키가 아예 안 실린다.
   */
  private setSessionCookie(res: Response, sid: string): void {
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('ENV') === AppEnv.PROD,
      path: '/',
      maxAge: SESSION_TTL_SECONDS * 1000,
      // ⭐ 🚫 이 옵션을 빼지 말 것. 빼면 서명 없이 심겨 가드의 `signedCookies` 조회가 항상
      //    비고, **로그인은 되는데 인증된 요청이 전부 401** 이 된다.
      signed: true,
    });
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '가입', description: '가입 후 바로 로그인 상태가 된다.' })
  @ApiSuccessResponse(MeDto, { status: HttpStatus.CREATED })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '아이디 중복 (code: `LOGIN_ID_TAKEN`)',
    type: ApiErrorBodyDto,
  })
  @ApiCommonValidationResponse()
  @ApiCommonThrottledResponse()
  @ApiCommonInternalServerErrorResponse()
  async signup(@Body() body: SignupRequestDto, @Res({ passthrough: true }) res: Response) {
    const sid = await this.auth.signup(body);
    this.setSessionCookie(res, sid);

    const data: Me = { loginId: body.loginId };
    return { code: SUCCESS_CODE, data, message: '' };
  }

  @Post('login')
  // ⚠️ `@Post` 의 Nest 기본 응답은 **201** 이다. 로그인은 자원을 만드는 것이 아니므로 200 이고,
  //    명시하지 않으면 Swagger(200)와 실제 응답(201)이 갈린다 — E2E 가 이 불일치를 잡았다.
  @HttpCode(HttpStatus.OK)
  // 전역 `long`(분당 60)으로는 대입 공격을 못 막는다 (THROTTLE_LOGIN 주석).
  @Throttle({ long: THROTTLE_LOGIN })
  @ApiOperation({
    summary: '로그인',
    description: '실패 사유를 구분하지 않는다 — 계정 존재 여부가 새어나가지 않게.',
  })
  @ApiSuccessResponse(MeDto)
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonThrottledResponse()
  @ApiCommonInternalServerErrorResponse()
  async login(@Body() body: LoginRequestDto, @Res({ passthrough: true }) res: Response) {
    const sid = await this.auth.login(body);
    this.setSessionCookie(res, sid);

    const data: Me = { loginId: body.loginId };
    return { code: SUCCESS_CODE, data, message: '' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃', description: '세션 쿠키를 지운다. 멱등이다.' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '성공' })
  @ApiCommonThrottledResponse()
  logout(@Res({ passthrough: true }) res: Response) {
    // 세션이 서명 쿠키라 서버에 지울 상태가 없다. 쿠키를 지우는 것이 곧 로그아웃이다.
    // ⚠️ 심을 때와 **같은 옵션**으로 지운다. path 가 다르면 브라우저가 다른 쿠키로 보고
    //    지우지 않는다 — 로그아웃했는데 세션 쿠키가 남는 형태로 드러난다.
    // 🚫 서버측 강제 만료는 없다. 훔친 쿠키는 만료까지 유효하다 (session.service 주석).
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '로그인 상태',
    description: '내가 만든 책 목록은 세션 테이블이 생기는 Slice 3 에서 붙는다.',
  })
  @ApiSuccessResponse(MeDto)
  @ApiCommonUnauthorizedResponse()
  @ApiCommonThrottledResponse()
  me(@CurrentUser() user: User | undefined) {
    // 가드가 통과시킨 요청에서만 도달하므로 user 는 항상 있다.
    const data: Me = { loginId: user!.loginId };
    return { code: SUCCESS_CODE, data, message: '' };
  }
}
