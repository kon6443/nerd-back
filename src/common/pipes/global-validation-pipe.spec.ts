import type { ArgumentMetadata } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { ApiErrorResponseDto } from '../dto/api-error.dto';
import { createGlobalValidationPipe } from './global-validation-pipe';

class SampleDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  count: number;
}

const META: ArgumentMetadata = { type: 'body', metatype: SampleDto };

describe('createGlobalValidationPipe', () => {
  const pipe = createGlobalValidationPipe();

  it('유효한 값은 통과시킨다', async () => {
    await expect(pipe.transform({ name: 'a', count: 2 }, META)).resolves.toMatchObject({
      name: 'a',
      count: 2,
    });
  });

  it('암묵 변환이 켜져 있어 문자열 숫자를 number 로 바꾼다', async () => {
    // 이게 되므로 DTO 에 @Type(() => Number) 를 붙이지 않는다.
    const result = (await pipe.transform({ name: 'a', count: '3' }, META)) as SampleDto;

    expect(result.count).toBe(3);
    expect(typeof result.count).toBe('number');
  });

  it('DTO 에 없는 필드가 오면 거부한다 (조용히 무시하지 않는다)', async () => {
    await expect(pipe.transform({ name: 'a', count: 1, extra: true }, META)).rejects.toBeInstanceOf(
      ApiErrorResponseDto,
    );
  });

  it('검증 실패는 VALIDATION_FAILED · 400 으로 던진다', async () => {
    const error = await pipe.transform({ name: 'a' }, META).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiErrorResponseDto);
    const typed = error as ApiErrorResponseDto;
    expect(typed.code).toBe('VALIDATION_FAILED');
    expect(typed.getStatus()).toBe(400);
  });

  it('details 에 실패한 필드명을 담는다', async () => {
    const error = (await pipe
      .transform({ name: 'a', count: 0 }, META)
      .catch((e: unknown) => e)) as ApiErrorResponseDto;

    expect(error.details).toEqual(expect.arrayContaining([expect.stringContaining('count')]));
  });
});
