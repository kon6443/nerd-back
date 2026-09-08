import { HttpStatus } from '@nestjs/common';
import { defineDomainError } from '@common/dto/define-domain-error';

/**
 * 로그인 실패. **아이디 없음과 비밀번호 불일치를 구분하지 않는다** —
 * 구분하면 그 차이가 곧 "그 아이디는 존재한다"는 신호가 된다.
 */
export const InvalidCredentialsErrorResponseDto = defineDomainError({
  code: 'INVALID_CREDENTIALS',
  status: HttpStatus.UNAUTHORIZED,
  message: '아이디 또는 비밀번호가 올바르지 않습니다.',
  name: 'InvalidCredentialsErrorResponseDto',
});

/**
 * 가입 시 아이디 중복.
 *
 * ⚠️ 이건 **의도적으로 존재를 알려준다.** 가입 화면에서는 "이미 쓰는 아이디"를 알려주지
 * 않으면 사용자가 아무것도 할 수 없다. 로그인 화면과 목적이 다르므로 정책도 다르다.
 */
export const LoginIdTakenErrorResponseDto = defineDomainError({
  code: 'LOGIN_ID_TAKEN',
  status: HttpStatus.CONFLICT,
  message: '이미 사용 중인 아이디입니다.',
  name: 'LoginIdTakenErrorResponseDto',
});

export const UnauthorizedErrorResponseDto = defineDomainError({
  code: 'UNAUTHORIZED',
  status: HttpStatus.UNAUTHORIZED,
  message: '로그인이 필요합니다.',
  name: 'UnauthorizedErrorResponseDto',
});

/**
 * 회원가입 비활성화 (내부 테스트 기간 등).
 */
export const SignupDisabledErrorResponseDto = defineDomainError({
  code: 'SIGNUP_DISABLED',
  status: HttpStatus.FORBIDDEN,
  message: '현재 내부 테스트 기간으로 신규 회원가입이 제한되어 있습니다.',
  name: 'SignupDisabledErrorResponseDto',
});

