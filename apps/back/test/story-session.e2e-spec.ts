import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { Server } from 'node:http';
import { API_PREFIX } from '@common/constants/app.constants';
import { AuthGuard } from '@common/guards/auth.guard';
import { User } from '@entities/user.entity';
import { SessionService } from '@modules/auth/session.service';
import { StorySessionController } from '@modules/story-session/story-session.controller';
import { StorySessionService } from '@modules/story-session/story-session.service';
import { createE2eApp } from './helpers/e2e-app';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const SESSIONS_PATH = `/${API_PREFIX}/sessions`;

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

function createServiceStub() {
  return {
    getAfterStory: jest.fn(),
    selectAfterStoryChoice: jest.fn(),
    retryAfterStoryPage: jest.fn(),
  };
}

describe('비하인드 A/B API (E2E)', () => {
  let app: INestApplication;
  let service: ReturnType<typeof createServiceStub>;

  beforeEach(async () => {
    service = createServiceStub();
    app = await createE2eApp({
      controllers: [StorySessionController],
      providers: [
        { provide: StorySessionService, useValue: service },
        // 컨트롤러의 실제 AuthGuard를 유지하되, 외부 세션·DB 의존성만 스텁한다.
        { provide: SessionService, useValue: { resolveUserId: () => 1 } },
        { provide: getRepositoryToken(User), useValue: { findOneBy: jest.fn().mockResolvedValue({ id: 1 }) } },
        AuthGuard,
      ],
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  it('GET /sessions/:id/after-story는 A/B 선택지와 결과 상태를 봉투로 반환한다', async () => {
    service.getAfterStory.mockResolvedValue({
      sessionId: SESSION_ID,
      firstBranchChoice: null,
      choices: [
        { branchKey: 'a', title: 'A 결과', description: 'A 설명', pageNo: 6, bodyText: 'A 원고', status: 'succeeded', imageUrl: 'https://image/a.png', errorMessage: null },
        { branchKey: 'b', title: 'B 결과', description: 'B 설명', pageNo: 6, bodyText: 'B 원고', status: 'pending', imageUrl: null, errorMessage: null },
      ],
    });

    const response = await request(server(app)).get(`${SESSIONS_PATH}/${SESSION_ID}/after-story`).expect(200);

    expect(response.body).toMatchObject({ code: 'SUCCESS', message: '', data: { firstBranchChoice: null } });
    expect(response.body.data.choices).toHaveLength(2);
    expect(service.getAfterStory).toHaveBeenCalledWith(1, SESSION_ID);
  });

  it('POST /sessions/:id/after-story/choice는 최초 선택을 검증하고 저장한다', async () => {
    service.selectAfterStoryChoice.mockResolvedValue({
      sessionId: SESSION_ID,
      branchKey: 'a',
      isFirstChoice: true,
    });

    await request(server(app))
      .post(`${SESSIONS_PATH}/${SESSION_ID}/after-story/choice`)
      .send({ branchKey: 'a' })
      .expect(201)
      .expect(({ body }) => expect(body.data).toMatchObject({ branchKey: 'a', isFirstChoice: true }));

    expect(service.selectAfterStoryChoice).toHaveBeenCalledWith(1, SESSION_ID, { branchKey: 'a' });
  });

  it('POST /sessions/:id/after-story/:branchKey/retry는 분기 결과만 재시도한다', async () => {
    service.retryAfterStoryPage.mockResolvedValue({
      sessionId: SESSION_ID,
      pageNo: 6,
      branchKey: 'b',
      status: 'pending',
    });

    await request(server(app))
      .post(`${SESSIONS_PATH}/${SESSION_ID}/after-story/b/retry`)
      .expect(202)
      .expect(({ body }) => expect(body.data).toMatchObject({ pageNo: 6, branchKey: 'b', status: 'pending' }));

    expect(service.retryAfterStoryPage).toHaveBeenCalledWith(1, SESSION_ID, 'b');
  });
});
