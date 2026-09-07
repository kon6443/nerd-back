import { HttpStatus } from '@nestjs/common';
import { ApiErrorResponseDto } from './api-error.dto';
import { defineDomainError } from './define-domain-error';

/**
 * ⭐ `code` 타입이 **`@nerd/contracts` 의 `DomainErrorCode` 유니온**이다.
 * 계약에 없는 코드를 쓰면 **컴파일이 실패한다** — 프론트가 모르는 분기가 배포되는 것을 막는다.
 * (그 성질은 타입 수준이라 런타임 테스트로 고정할 수 없다. 여기서는 팩토리 동작만 본다.)
 */
const StoryNotFound = defineDomainError({
  code: 'STORY_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '동화를 찾을 수 없습니다.',
  name: 'StoryNotFoundTestDto',
});

describe('defineDomainError', () => {
  it('기본 메시지로 만든다', () => {
    const error = new StoryNotFound();

    expect(error).toBeInstanceOf(ApiErrorResponseDto);
    expect(error.code).toBe('STORY_NOT_FOUND');
    expect(error.message).toBe('동화를 찾을 수 없습니다.');
    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('메시지를 override 할 수 있다', () => {
    expect(new StoryNotFound('만료되었습니다.').message).toBe('만료되었습니다.');
  });

  it('details 를 담는다', () => {
    expect(new StoryNotFound(undefined, ['id: 필수입니다.']).details).toEqual(['id: 필수입니다.']);
  });

  it('details 를 안 주면 undefined 다 — 필터가 키 자체를 빼는 근거다', () => {
    expect(new StoryNotFound().details).toBeUndefined();
  });

  it('클래스 이름을 박는다 — 스택트레이스에 익명으로 찍히지 않게 ⭐', () => {
    expect(StoryNotFound.name).toBe('StoryNotFoundTestDto');
  });
});
