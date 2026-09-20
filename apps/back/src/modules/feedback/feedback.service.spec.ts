import type { Repository } from 'typeorm';
import type { NotificationPort } from '@common/port/notification.port';
import { Feedback } from '@entities/feedback.entity';
import { createFeedback } from '@entities/__spec__/entity.factory';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let repo: jest.Mocked<Repository<Feedback>>;
  let notification: jest.Mocked<NotificationPort>;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Feedback>>;

    notification = {
      notify: jest.fn(),
    };

    service = new FeedbackService(repo, notification);
  });

  it('피드백을 저장하고 Discord 알림을 발송한다', async () => {
    const mockFeedback = createFeedback({
      id: 42,
      userId: 7,
      category: 'feature',
      title: '새로운 동화 요청',
      content: '신데렐라 동화도 추가해주세요!',
      pageUrl: '/library',
      deviceInfo: { browser: 'Safari', os: 'iOS' },
    });

    repo.create.mockReturnValue(mockFeedback);
    repo.save.mockResolvedValue(mockFeedback);

    const result = await service.create(7, {
      category: 'feature',
      title: '새로운 동화 요청',
      content: '신데렐라 동화도 추가해주세요!',
      pageUrl: '/library',
      deviceInfo: { browser: 'Safari', os: 'iOS' },
    });

    expect(repo.create).toHaveBeenCalledWith({
      userId: 7,
      category: 'feature',
      title: '새로운 동화 요청',
      content: '신데렐라 동화도 추가해주세요!',
      pageUrl: '/library',
      deviceInfo: { browser: 'Safari', os: 'iOS' },
    });
    expect(repo.save).toHaveBeenCalledWith(mockFeedback);

    expect(notification.notify).toHaveBeenCalledTimes(1);
    expect(notification.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        title: '[피드백: 기능 제안] 새로운 동화 요청',
        summary: '신데렐라 동화도 추가해주세요!',
        context: expect.objectContaining({
          '피드백 ID': 42,
          '작성자 유저 ID': 7,
          '카테고리': '기능 제안',
          '발생 경로': '/library',
          '브라우저': 'Safari',
          'OS': 'iOS',
        }),
      }),
    );

    expect(result).toEqual({
      id: 42,
      category: 'feature',
      title: '새로운 동화 요청',
      createdAt: mockFeedback.createdAt.toISOString(),
    });
  });

  it('알림 전송 중 에러가 발생해도 피드백 저장은 정상 완료된다', async () => {
    const mockFeedback = createFeedback();
    repo.create.mockReturnValue(mockFeedback);
    repo.save.mockResolvedValue(mockFeedback);

    notification.notify.mockImplementation(() => {
      throw new Error('Discord webhook network error');
    });

    const result = await service.create(1, {
      category: 'bug',
      title: '버그 신고',
      content: '버그가 발생했습니다.',
    });

    expect(result.id).toBe(1);
    expect(repo.save).toHaveBeenCalled();
  });
});
