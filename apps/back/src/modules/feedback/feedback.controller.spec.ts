import { SUCCESS_CODE } from '@common/constants/app.constants';
import type { User } from '@entities/user.entity';
import { FeedbackController } from './feedback.controller';
import type { FeedbackService } from './feedback.service';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let service: jest.Mocked<FeedbackService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
    } as unknown as jest.Mocked<FeedbackService>;

    controller = new FeedbackController(service);
  });

  it('사용자 ID와 DTO를 서비스로 전달하고 표준 성공 응답을 반환한다', async () => {
    const mockUser = { id: 10 } as User;
    const mockResult = {
      id: 1,
      category: 'bug' as const,
      title: '제목',
      createdAt: '2026-09-20T00:00:00.000Z',
    };

    service.create.mockResolvedValue(mockResult);

    const dto = {
      category: 'bug' as const,
      title: '제목',
      content: '내용입니다.',
      pageUrl: '/',
    };

    const res = await controller.create(mockUser, dto);

    expect(service.create).toHaveBeenCalledWith(10, dto);
    expect(res).toEqual({
      code: SUCCESS_CODE,
      data: mockResult,
      message: '',
    });
  });
});
