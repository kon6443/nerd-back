import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SUCCESS_CODE } from '@common/constants/app.constants';
import {
  ApiCommonInternalServerErrorResponse,
  ApiCommonThrottledResponse,
  ApiCommonValidationResponse,
} from '@common/decorators/api-error-response.decorator';
import { ApiSuccessResponse } from '@common/decorators/api-success-response.decorator';
import { ApiErrorBodyDto } from '@common/dto/api-error.dto';
import { StoryPageParamsDto, StorySlugParamsDto } from './dto/story-params.dto';
import { StoryDetailDto, StoryPageDto, StorySummaryDto } from './dto/story-response.dto';
import { StoryService } from './story.service';

@ApiTags('stories')
@Controller('stories')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({
    summary: '동화 목록 (SPEC-001)',
    description: '공개된 동화만 반환한다. 제작 중(draft) 동화는 목록에 나타나지 않는다.',
  })
  @ApiSuccessResponse(StorySummaryDto, { isArray: true })
  @ApiCommonThrottledResponse()
  @ApiCommonInternalServerErrorResponse()
  async list() {
    const data = await this.storyService.listPublished();
    return { code: SUCCESS_CODE, data, message: '' };
  }

  @Get(':slug')
  @ApiOperation({
    summary: '동화 상세 (SPEC-001)',
    description: '페이지 수와 등장인물 목록을 반환한다. 등장인물의 persona 는 내보내지 않는다.',
  })
  @ApiSuccessResponse(StoryDetailDto)
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '동화 없음 (code: `STORY_NOT_FOUND`)',
    type: ApiErrorBodyDto,
  })
  @ApiCommonValidationResponse()
  @ApiCommonThrottledResponse()
  @ApiCommonInternalServerErrorResponse()
  async detail(@Param() params: StorySlugParamsDto) {
    const data = await this.storyService.getPublishedDetail(params.slug);
    return { code: SUCCESS_CODE, data, message: '' };
  }

  @Get(':slug/pages/:pageNo')
  @ApiOperation({
    summary: '동화 페이지 조회 (SPEC-004)',
    description: '본문과 대화 가능한 등장인물을 반환한다. 개인화 이미지는 별도 슬라이스가 붙인다.',
  })
  @ApiSuccessResponse(StoryPageDto)
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '동화 또는 페이지 없음 (code: `STORY_NOT_FOUND` · `STORY_PAGE_NOT_FOUND`)',
    type: ApiErrorBodyDto,
  })
  @ApiCommonValidationResponse()
  @ApiCommonThrottledResponse()
  @ApiCommonInternalServerErrorResponse()
  async page(@Param() params: StoryPageParamsDto) {
    const data = await this.storyService.getPublishedPage(params.slug, params.pageNo);
    return { code: SUCCESS_CODE, data, message: '' };
  }
}
