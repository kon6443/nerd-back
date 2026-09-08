import {
  Body,
  Controller,
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
import { SUCCESS_CODE } from '@common/constants/app.constants';
import {
  ApiCommonInternalServerErrorResponse,
  ApiCommonUnauthorizedResponse,
  ApiCommonValidationResponse,
} from '@common/decorators/api-error-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthGuard } from '@common/guards/auth.guard';
import { User } from '@entities/user.entity';
import { StorySessionService } from './story-session.service';
import { CreateSessionRequestDto, SessionIdParamsDto } from './dto/story-session-request.dto';
import type { ApiSuccess, StorySessionSummary, UploadFaceResponse } from '@nerd/contracts';

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

  @Post(':id/face')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'left', maxCount: 1 },
      { name: 'right', maxCount: 1 },
    ]),
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
}
