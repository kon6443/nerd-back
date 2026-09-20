import {
  Body,
  Controller,
  Header,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SUCCESS_CODE } from '@common/constants/app.constants';
import { THROTTLE_FEEDBACK } from '@common/constants/throttle.constants';
import {
  ApiCommonInternalServerErrorResponse,
  ApiCommonThrottledResponse,
  ApiCommonUnauthorizedResponse,
  ApiCommonValidationResponse,
} from '@common/decorators/api-error-response.decorator';
import { ApiSuccessResponse } from '@common/decorators/api-success-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthGuard } from '@common/guards/auth.guard';
import type { User } from '@entities/user.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedbacks')
@Controller('feedbacks')
@UseGuards(AuthGuard)
@ApiCommonUnauthorizedResponse()
@ApiCommonValidationResponse()
@ApiCommonThrottledResponse()
@ApiCommonInternalServerErrorResponse()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Throttle({ long: THROTTLE_FEEDBACK })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: '사용자 피드백 전송',
    description: '로그인한 사용자의 서비스 피드백을 저장하고 디스코드 운영 채널로 알림을 보냅니다.',
  })
  @ApiSuccessResponse(FeedbackResponseDto, { status: HttpStatus.CREATED })
  async create(
    @CurrentUser() user: User | undefined,
    @Body() dto: CreateFeedbackDto,
  ) {
    const data = await this.feedbackService.create(user!.id, dto);
    return { code: SUCCESS_CODE, data, message: '' };
  }
}
