import { HttpStatus, applyDecorators } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../dto/api-response.dto';

/**
 * 성공 응답을 Swagger 에 붙인다 — `{ code, data, message }` 봉투 + `data` 의 타입.
 *
 * 이게 없으면 엔드포인트마다 `class XxxResponseDto extends ApiSuccessResponseDto { data: ... }`
 * 를 손으로 만들게 된다. **쓰이지 않는 클래스가 엔드포인트 수만큼 늘고**, 봉투 형태가 바뀌면
 * 전부를 고쳐야 한다.
 *
 * ```ts
 * @ApiSuccessResponse(StorySummaryDto, { isArray: true })   // data: StorySummaryDto[]
 * @ApiSuccessResponse(StoryDetailDto)                        // data: StoryDetailDto
 * ```
 *
 * ⚠️ `allOf` + `getSchemaPath` 를 쓰는 이유: 제네릭은 **런타임에 지워지므로** `type:` 만으로는
 * `data` 의 타입을 표현할 수 없다. `ApiExtraModels` 로 두 스키마를 문서에 등록한 뒤 참조로 잇는다.
 */
export function ApiSuccessResponse<T extends Type<unknown>>(
  dataType: T,
  /**
   * `status` 는 **쓰이지 않아도 남긴다** — §2 가 "생성은 201, 본문 없음은 204. 전부 200 으로
   * 통일하지 않는다" 를 요구하므로, 200 만 표현하는 데코레이터는 그 규약을 못 담는다.
   * 🚫 그 밖의 옵션은 소비자가 생길 때 추가한다(설명문은 `@ApiOperation` 이 이미 담는다).
   */
  options: { isArray?: boolean; status?: HttpStatus } = {},
) {
  const { isArray = false, status = HttpStatus.OK } = options;

  return applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, dataType),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseDto) },
          {
            properties: {
              data: isArray
                ? { type: 'array', items: { $ref: getSchemaPath(dataType) } }
                : { $ref: getSchemaPath(dataType) },
            },
          },
        ],
      },
    }),
  );
}
