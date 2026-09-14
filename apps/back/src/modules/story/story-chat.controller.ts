import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SUCCESS_CODE } from '@common/constants/app.constants';
import {
  ApiCommonInternalServerErrorResponse,
  ApiCommonThrottledResponse,
  ApiCommonUnauthorizedResponse,
  ApiCommonValidationResponse,
} from '@common/decorators/api-error-response.decorator';
import { ApiSuccessResponse } from '@common/decorators/api-success-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiErrorBodyDto } from '@common/dto/api-error.dto';
import { AuthGuard } from '@common/guards/auth.guard';
import type { User } from '@entities/user.entity';
import {
  StoryChatInputDto,
  StoryChatViewDto,
  StoryChatParamsDto,
  StoryChatQueryDto,
} from './dto/story-chat.dto';
import { StoryChatService } from './story-chat.service';

@ApiTags('sessions')
@Controller('sessions/:sessionId/pages/:pageNo/chat')
@UseGuards(AuthGuard)
@ApiCommonUnauthorizedResponse()
@ApiCommonValidationResponse()
@ApiCommonThrottledResponse()
@ApiCommonInternalServerErrorResponse()
@ApiResponse({
  status: HttpStatus.NOT_FOUND,
  type: ApiErrorBodyDto,
  description: '본인 동화가 아니거나 페이지 또는 등장인물이 없음',
})
@ApiResponse({
  status: HttpStatus.SERVICE_UNAVAILABLE,
  type: ApiErrorBodyDto,
  description: '대화 이용 상태 확인 불가 또는 AI 설정 미완료',
})
export class StoryChatController {
  constructor(private readonly chats: StoryChatService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '내 페이지 대화와 남은 횟수 조회' })
  @ApiSuccessResponse(StoryChatViewDto)
  async get(
    @CurrentUser() user: User | undefined,
    @Param() params: StoryChatParamsDto,
    @Query() query: StoryChatQueryDto,
  ) {
    const data = await this.chats.get(user!.id, params.sessionId, params.pageNo, query.branchKey);
    return { code: SUCCESS_CODE, data, message: '' };
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: '현재 페이지 등장인물에게 한 번 질문',
    description:
      '보관된 동화의 장면 전체에서 총 1회. 본편(common)과 비하인드(a/b)는 별도 장면이다. 소유자만 질문 가능하며 요청 후 AI 응답 실패에도 횟수를 복구하지 않는다.',
  })
  @ApiSuccessResponse(StoryChatViewDto, { status: HttpStatus.CREATED })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    type: ApiErrorBodyDto,
    description: '이미 질문한 페이지 (STORY_CHAT_ALREADY_USED)',
  })
  async send(
    @CurrentUser() user: User | undefined,
    @Param() params: StoryChatParamsDto,
    @Body() input: StoryChatInputDto,
    @Query() query: StoryChatQueryDto,
  ) {
    const data = await this.chats.send(
      user!.id,
      params.sessionId,
      params.pageNo,
      input,
      query.branchKey,
    );
    return { code: SUCCESS_CODE, data, message: '' };
  }

  @Post('audio')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '실패한 캐릭터 답변 음성만 다시 생성' })
  @ApiSuccessResponse(StoryChatViewDto)
  async retryAudio(
    @CurrentUser() user: User | undefined,
    @Param() params: StoryChatParamsDto,
    @Query() query: StoryChatQueryDto,
  ) {
    const data = await this.chats.retryAudio(
      user!.id,
      params.sessionId,
      params.pageNo,
      query.branchKey,
    );
    return { code: SUCCESS_CODE, data, message: '' };
  }
}
