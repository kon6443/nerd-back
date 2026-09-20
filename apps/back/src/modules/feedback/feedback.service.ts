import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
  type FeedbackResult,
} from '@nerd/contracts';
import { NOTIFICATION_PORT, type NotificationPort } from '@common/port/notification.port';
import { Feedback } from '@entities/feedback.entity';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @Inject(NOTIFICATION_PORT)
    private readonly notification: NotificationPort,
  ) {}

  async create(userId: number, dto: CreateFeedbackDto): Promise<FeedbackResult> {
    const entity = this.feedbackRepo.create({
      userId,
      category: dto.category,
      title: dto.title,
      content: dto.content,
      pageUrl: dto.pageUrl ?? null,
      deviceInfo: dto.deviceInfo ?? null,
    });

    const saved = await this.feedbackRepo.save(entity);

    // Discord 운영 알림 전송 (fire-and-forget)
    this.sendNotification(saved);

    return {
      id: saved.id,
      category: saved.category as FeedbackCategory,
      title: saved.title,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  private sendNotification(feedback: Feedback): void {
    try {
      const categoryLabel =
        FEEDBACK_CATEGORY_LABELS[feedback.category as FeedbackCategory] ?? feedback.category;
      const title = `[피드백: ${categoryLabel}] ${feedback.title}`;

      const context: Record<string, string | number> = {
        '피드백 ID': feedback.id,
        '작성자 유저 ID': feedback.userId,
        '카테고리': categoryLabel,
      };

      if (feedback.pageUrl) {
        context['발생 경로'] = feedback.pageUrl;
      }

      if (feedback.deviceInfo && typeof feedback.deviceInfo === 'object') {
        const info = feedback.deviceInfo as Record<string, unknown>;
        if (typeof info.browser === 'string') context['브라우저'] = info.browser;
        if (typeof info.os === 'string') context['OS'] = info.os;
        if (typeof info.screenResolution === 'string') context['해상도'] = info.screenResolution;
      }

      this.notification.notify({
        severity: 'info',
        title,
        summary: feedback.content,
        context,
      });
    } catch (err) {
      // 알림 실패가 피드백 저장 응답을 방해하지 않는다.
      this.logger.warn(`피드백 알림 발송 중 오류 발생: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
