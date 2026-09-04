import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { storyPageParamsSchema } from '@nerd/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiErrorResponseDto } from '../dto/api-error.dto';
import { createGlobalValidationPipe, toValidationDetails } from './global-validation-pipe';

const sampleSchema = z
  .object({
    name: z.string(),
    // 경로·쿼리 값은 문자열로 도착한다. 스키마가 **명시적으로** 변환한다.
    count: z.coerce.number().int().min(1, 'count 는 1 이상이어야 합니다.'),
  })
  .strict();

class SampleDto extends createZodDto(sampleSchema) {}

/** contracts 가 소유한 스키마. 앱과 **다른 zod 인스턴스**로 만들어졌다 (↓ 마지막 describe). */
class ContractDto extends createZodDto(storyPageParamsSchema) {}

const META: ArgumentMetadata = { type: 'body', metatype: SampleDto };
const CONTRACT_META: ArgumentMetadata = { type: 'param', metatype: ContractDto };

describe('createGlobalValidationPipe', () => {
  let pipe: PipeTransform;

  beforeEach(() => {
    pipe = createGlobalValidationPipe();
  });

  /** ⚠️ 파이프는 **동기로** 던진다. 성공값과 예외를 한 형태로 받아 단정한다. */
  function run(value: unknown, meta: ArgumentMetadata = META): unknown {
    try {
      return pipe.transform(value, meta);
    } catch (error) {
      return error;
    }
  }

  it('유효한 값은 통과시킨다', () => {
    expect(run({ name: 'a', count: 2 })).toMatchObject({ name: 'a', count: 2 });
  });

  it('스키마가 문자열 숫자를 명시적으로 변환한다 ⭐', () => {
    // class-validator 시절의 enableImplicitConversion 을 대체한다. 변환이 스키마에 보이는 것이
    // 중요하다 — 어디서 형이 바뀌는지 코드를 읽어 알 수 있다.
    const result = run({ name: 'a', count: '3' }) as { count: number };

    expect(result.count).toBe(3);
    expect(typeof result.count).toBe('number');
  });

  it('스키마에 없는 필드가 오면 거부한다 (조용히 무시하지 않는다)', () => {
    // .strict() 가 막는다. class-validator 의 forbidNonWhitelisted 를 대체한다.
    expect(run({ name: 'a', count: 1, extra: true })).toBeInstanceOf(ApiErrorResponseDto);
  });

  it('검증 실패는 VALIDATION_FAILED · 400 으로 던진다 ⭐', () => {
    // 응답 형식은 프론트와의 계약이다. 검증 라이브러리를 바꿔도 이 형식은 바뀌면 안 된다.
    const error = run({ name: 'a' });

    expect(error).toBeInstanceOf(ApiErrorResponseDto);
    const typed = error as ApiErrorResponseDto;
    expect(typed.code).toBe('VALIDATION_FAILED');
    expect(typed.getStatus()).toBe(400);
  });

  it('details 에 `필드: 메시지` 를 담는다', () => {
    const error = run({ name: 'a', count: 0 }) as ApiErrorResponseDto;

    expect(error.details).toEqual([expect.stringContaining('count: ')]);
  });

  it('nestjs-zod DTO 가 아니면 막는다 ⭐', () => {
    // strictSchemaDeclaration. "검증한다고 생각했는데 안 하고 있었다" 를 도구가 잡게 한다.
    class PlainDto {
      name: string;
    }

    const error = run({ name: 'a' }, { type: 'body', metatype: PlainDto });

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiErrorResponseDto);
  });

  describe('다른 zod 인스턴스로 만든 스키마 ⭐', () => {
    // 워크스페이스가 앱별 node_modules 를 쓰므로(sharedWorkspaceLockfile: false)
    // @nerd/contracts 의 zod 와 apps/back 의 zod 는 **다른 인스턴스**다.
    // instanceof 로 판별하면 여기서 details 가 조용히 비어 검증 사유만 사라진다.
    it('통과 경로가 정상 동작한다', () => {
      expect(run({ slug: 'snow-white', pageNo: '2' }, CONTRACT_META)).toMatchObject({
        slug: 'snow-white',
        pageNo: 2,
      });
    });

    it('실패해도 details 가 비지 않는다', () => {
      const error = run({ slug: 'Bad_Slug', pageNo: '0' }, CONTRACT_META) as ApiErrorResponseDto;

      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details).toEqual(
        expect.arrayContaining([expect.stringContaining('slug: '), expect.stringContaining('pageNo: ')]),
      );
    });
  });
});

describe('toValidationDetails', () => {
  it('issues 가 없는 값에는 빈 배열을 준다', () => {
    expect(toValidationDetails(undefined)).toEqual([]);
    expect(toValidationDetails(new Error('boom'))).toEqual([]);
  });

  it('중첩 경로를 점으로 잇는다', () => {
    const error = { issues: [{ path: ['user', 'name'], message: '필수입니다.' }] };

    expect(toValidationDetails(error)).toEqual(['user.name: 필수입니다.']);
  });

  it('경로가 비면 메시지만 남긴다', () => {
    expect(toValidationDetails({ issues: [{ path: [], message: '형식 오류' }] })).toEqual([
      '형식 오류',
    ]);
  });
});
