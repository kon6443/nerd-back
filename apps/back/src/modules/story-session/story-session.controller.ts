import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { SUCCESS_CODE } from '@common/constants/app.constants';
import { SKIP_ALL_THROTTLERS } from '@common/constants/throttle.constants';
import {
  ApiCommonInternalServerErrorResponse,
  ApiCommonUnauthorizedResponse,
  ApiCommonValidationResponse,
} from '@common/decorators/api-error-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthGuard } from '@common/guards/auth.guard';
import { MAX_IMAGE_SIZE_BYTES } from '@common/utils/image-validator';
import { User } from '@entities/user.entity';
import { StorySessionService } from './story-session.service';
import {
  CreateSessionRequestDto,
  AfterStoryRetryParamsDto,
  SessionIdParamsDto,
  SessionPageParamsDto,
  SelectAfterStoryChoiceDto,
} from './dto/story-session-request.dto';
import type {
  ApiSuccess,
  MyStorySessionItem,
  PersonalizeSessionResponse,
  RetryPageResponse,
  RetryAfterStoryResponse,
  SessionPagesResponse,
  StorySessionSummary,
  UploadFaceResponse,
  AfterStoryResponse,
  SelectAfterStoryChoiceResponse,
} from '@nerd/contracts';

@ApiTags('sessions')
@Controller('sessions')
export class StorySessionController {
  constructor(private readonly sessionService: StorySessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '동화 제작 세션 생성 / 재사용 (1인 1권 제한)',
    description: '동화 슬러그로 세션을 생성하거나 미완료 세션을 재사용합니다. 이미 완성된 동화는 409를 반환합니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonInternalServerErrorResponse()
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '이미 완성된 동화 (code: STORY_ALREADY_COMPLETED)' })
  async createSession(
    @CurrentUser() user: User,
    @Body() body: CreateSessionRequestDto,
  ): Promise<ApiSuccess<StorySessionSummary>> {
    const session = await this.sessionService.createOrResumeSession(user.id, body.templateSlug);
    return {
      code: SUCCESS_CODE,
      data: session,
      message: '',
    };
  }

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '사용자의 동화 세션 목록 조회',
    description: '사용자가 생성했거나 생성 중인 동화 세션 목록을 반환합니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonInternalServerErrorResponse()
  async getMySessions(
    @CurrentUser() user: User,
  ): Promise<ApiSuccess<MyStorySessionItem[]>> {
    const list = await this.sessionService.getMySessions(user.id);
    return {
      code: SUCCESS_CODE,
      data: list,
      message: '',
    };
  }

  @Post(':id/face')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  // ⚠️ `limits` 가 없으면 multer 가 **파일 전체를 메모리에 다 올린 뒤에야** 서비스로 넘긴다.
  //    `validateImageBuffer` 의 5MB 검사는 그 다음이라, 수백 MB 를 보내면 400 을 돌려주기도 전에
  //    레플리카가 메모리를 먹는다. 여기서 끊어야 버퍼링 자체가 멈춘다.
  //
  // ⭐ **한도를 `MAX_IMAGE_SIZE_BYTES` 와 같게 두지 않는다.** multer 가 한도를 넘기면
  //    `MulterError` 를 던지는데, 그것은 `HttpException` 이 아니라 전역 필터 4단으로 떨어져
  //    **500 + 고정 메시지**가 된다(`http-exception.filter.ts`). 그러면 "5MB 이하여야 한다" 는
  //    친절한 400(`IMAGE_TOO_LARGE`)이 사라진다. 그래서 **판정은 서비스가, 방어는 여기가** 맡는다:
  //    정상 범위를 조금 넘는 파일은 서비스가 400 으로 정확히 답하고, 그보다 큰 것만 여기서 끊는다.
  //    (프론트는 1024px JPEG q0.85 로 재인코딩해 보내므로 정상 경로는 수백 KB 다.)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'left', maxCount: 1 },
        { name: 'right', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_SIZE_BYTES * 2, files: 3 } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '얼굴 사진 업로드 및 캐릭터 레퍼런스 생성 (동기)',
    description: '정면 1장 필수, 좌/우 선택으로 얼굴 사진을 업로드하고 레퍼런스 이미지를 생성합니다. 원본은 즉시 폐기됩니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonInternalServerErrorResponse()
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '매직바이트 불일치 또는 5MB 초과' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '세션 없음 (code: SESSION_NOT_FOUND)' })
  async uploadFace(
    @CurrentUser() user: User,
    @Param() params: SessionIdParamsDto,
    @UploadedFiles()
    files: {
      front?: Express.Multer.File[];
      left?: Express.Multer.File[];
      right?: Express.Multer.File[];
    },
  ): Promise<ApiSuccess<UploadFaceResponse>> {
    const result = await this.sessionService.uploadFace(user.id, params.id, files);
    return {
      code: SUCCESS_CODE,
      data: result,
      message: '',
    };
  }

  @Post(':id/personalize')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '동화 페이지 개인화 비동기 파이프라인 시작 (202 Accepted)',
    description: '동화의 전 페이지 삽화 생성을 백그라운드로 시작합니다. 멱등성을 지원합니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonInternalServerErrorResponse()
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: '생성 작업 시작됨' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '세션 없음' })
  async personalize(
    @CurrentUser() user: User,
    @Param() params: SessionIdParamsDto,
  ): Promise<ApiSuccess<PersonalizeSessionResponse>> {
    const result = await this.sessionService.personalizeSession(user.id, params.id);
    return {
      code: SUCCESS_CODE,
      data: result,
      message: '',
    };
  }

  @Get(':id/pages')
  @SkipThrottle(SKIP_ALL_THROTTLERS)
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '페이지 개인화 진행 상태 폴링',
    description: '세션의 페이지별 생성 상태(pending, running, succeeded, failed)와 완성된 서명 URL 목록을 조회합니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonInternalServerErrorResponse()
  @ApiResponse({ status: HttpStatus.OK, description: '페이지 상태 목록' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '세션 없음' })
  async getPages(
    @CurrentUser() user: User,
    @Param() params: SessionIdParamsDto,
  ): Promise<ApiSuccess<SessionPagesResponse>> {
    const result = await this.sessionService.getSessionPages(user.id, params.id);
    return {
      code: SUCCESS_CODE,
      data: result,
      message: '',
    };
  }

  @Get(':id/after-story')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '비하인드 A/B 선택지와 결과 생성 상태 조회' })
  async getAfterStory(
    @CurrentUser() user: User,
    @Param() params: SessionIdParamsDto,
  ): Promise<ApiSuccess<AfterStoryResponse>> {
    const result = await this.sessionService.getAfterStory(user.id, params.id);
    return { code: SUCCESS_CODE, data: result, message: '' };
  }

  @Post(':id/after-story/choice')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '비하인드 최초 A/B 선택 저장' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '최초 선택이 이미 다른 값으로 저장됨' })
  async selectAfterStoryChoice(
    @CurrentUser() user: User,
    @Param() params: SessionIdParamsDto,
    @Body() body: SelectAfterStoryChoiceDto,
  ): Promise<ApiSuccess<SelectAfterStoryChoiceResponse>> {
    const result = await this.sessionService.selectAfterStoryChoice(user.id, params.id, body);
    return { code: SUCCESS_CODE, data: result, message: '' };
  }

  @Post(':id/after-story/:branchKey/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '실패한 비하인드 A/B 결과 재시도' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: '분기 결과 재시도 작업 시작됨' })
  async retryAfterStoryPage(
    @CurrentUser() user: User,
    @Param() params: AfterStoryRetryParamsDto,
  ): Promise<ApiSuccess<RetryAfterStoryResponse>> {
    const result = await this.sessionService.retryAfterStoryPage(user.id, params.id, params.branchKey);
    return { code: SUCCESS_CODE, data: result, message: '' };
  }

  @Post(':id/pages/:pageNo/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '실패한 특정 페이지 개인화 재시도',
    description:
      'failed 이거나 오래 멈춘(고아) 페이지만 다시 백그라운드로 재생성합니다. 생성 중인 페이지는 400 으로 거절합니다 — 다른 인스턴스가 만들고 있는 삽화를 빼앗아 유료 생성이 중복되는 것을 막습니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonInternalServerErrorResponse()
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: '재시도 작업 시작됨' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '실패한 페이지가 아님' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '세션 또는 페이지 없음' })
  async retryPage(
    @CurrentUser() user: User,
    @Param() params: SessionPageParamsDto,
  ): Promise<ApiSuccess<RetryPageResponse>> {
    const result = await this.sessionService.retryPage(user.id, params.id, params.pageNo);
    return {
      code: SUCCESS_CODE,
      data: result,
      message: '',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '동화 세션 삭제 (재생성을 위한 리셋)',
    description: '세션 및 관련 생성 이미지를 삭제하여 다른 얼굴로 다시 제작할 수 있도록 합니다.',
  })
  @ApiCommonUnauthorizedResponse()
  @ApiCommonValidationResponse()
  @ApiCommonInternalServerErrorResponse()
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '세션 삭제 완료' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '세션 없음' })
  async deleteSession(
    @CurrentUser() user: User,
    @Param() params: SessionIdParamsDto,
  ): Promise<void> {
    await this.sessionService.deleteSession(user.id, params.id);
  }
}
