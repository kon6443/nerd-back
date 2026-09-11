import {
  asRepository,
  createMockRepository,
  mockUpdateQueryBuilder,
  type MockRepository,
} from '@common/__spec__/mock-repository';
import { createStoryPage } from '@entities/__spec__/entity.factory';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryAfterStoryChoice } from '@entities/story-after-story-choice.entity';
import { SessionBranchChoice } from '@entities/session-branch-choice.entity';
import { StoryNotFoundErrorResponseDto } from '@modules/story/dto/story.error.dto';
import {
  FaceNotReadyErrorResponseDto,
  FaceRequiredErrorResponseDto,
  InvalidImageFormatErrorResponseDto,
  PageNotFoundErrorResponseDto,
  PageNotFailedErrorResponseDto,
  SessionNotFoundErrorResponseDto,
  StoryAlreadyCompletedErrorResponseDto,
  FirstBranchAlreadyChosenErrorResponseDto,
} from './dto/story-session-error.dto';
import { StorySessionService } from './story-session.service';
import type { DataSource } from 'typeorm';
import { addTransactionalDataSource, deleteDataSourceByName } from 'typeorm-transactional';
import type { ImageGenerationPort } from '../../common/port/image-generation.port';
import type { StoragePort } from '../../common/port/storage.port';

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe('StorySessionService', () => {
  let sessionRepo: MockRepository<StorySession>;
  let templateRepo: MockRepository<StoryTemplate>;
  let pageRepo: MockRepository<StoryPage>;
  let pageImageRepo: MockRepository<SessionPageImage>;
  let afterStoryChoiceRepo: MockRepository<StoryAfterStoryChoice>;
  let branchChoiceRepo: MockRepository<SessionBranchChoice>;
  let mockImagePort: jest.Mocked<ImageGenerationPort>;
  let mockStoragePort: jest.Mocked<StoragePort>;
  let service: StorySessionService;

  // `deleteSession` 의 `@Transactional()` 은 레지스트리에서 DataSource 를 찾아
  // `dataSource.transaction(cb)` 를 부른다. 단위 테스트는 mock repository 만 쓰므로 실제
  // 트랜잭션도 EntityManager 도 필요 없다 — 콜백을 그대로 실행하는 스텁을 `patch: false` 로
  // 등록해 래퍼만 통과시킨다.
  // 🚫 진짜 `DataSource` 를 만들지 않는다 — 생성자가 드라이버를 들며 `mysql2` 를 로드해
  //    forbid-db 스텁에 걸린다 (test/setup/forbid-db.ts).
  beforeAll(() => {
    deleteDataSourceByName('default');
    addTransactionalDataSource({
      name: 'default',
      dataSource: {
        transaction: <T>(cb: (em: unknown) => Promise<T>): Promise<T> => cb({}),
      } as unknown as DataSource,
      patch: false,
    });
  });

  afterAll(() => {
    deleteDataSourceByName('default');
  });

  beforeEach(() => {
    sessionRepo = createMockRepository<StorySession>();
    templateRepo = createMockRepository<StoryTemplate>();
    pageRepo = createMockRepository<StoryPage>();
    pageImageRepo = createMockRepository<SessionPageImage>();
    afterStoryChoiceRepo = createMockRepository<StoryAfterStoryChoice>();
    branchChoiceRepo = createMockRepository<SessionBranchChoice>();

    mockImagePort = {
      generateReference: jest.fn().mockResolvedValue(Buffer.from('mock-reference-image-bytes')),
      generatePageIllustration: jest.fn().mockResolvedValue(Buffer.from('mock-page-image-bytes')),
    };

    mockStoragePort = {
      upload: jest.fn().mockResolvedValue('references/session-1/ref.png'),
      getPresignedUrl: jest.fn().mockResolvedValue('https://storage.local/references/session-1/ref.png'),
      download: jest.fn().mockResolvedValue(Buffer.from('mock-downloaded-bytes')),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    service = new StorySessionService(
      asRepository(sessionRepo),
      asRepository(templateRepo),
      asRepository(pageRepo),
      asRepository(pageImageRepo),
      mockImagePort,
      mockStoragePort,
      undefined,
      asRepository(afterStoryChoiceRepo),
      asRepository(branchChoiceRepo),
    );
  });

  describe('비하인드 분기', () => {
    const session = { id: 'session-123', userId: 1, templateId: 10 } as StorySession;

    it('A/B 선택지·개인화 상태·최초 선택을 함께 반환한다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      afterStoryChoiceRepo.find.mockResolvedValue([
        { branchKey: 'a', title: 'A', description: 'A 설명' },
        { branchKey: 'b', title: 'B', description: 'B 설명' },
      ] as StoryAfterStoryChoice[]);
      pageRepo.find.mockResolvedValue([
        { pageNo: 6, branchKey: 'a', bodyText: 'A 결과' },
        { pageNo: 6, branchKey: 'b', bodyText: 'B 결과' },
      ] as StoryPage[]);
      pageImageRepo.find.mockResolvedValue([
        { pageNo: 6, branchKey: 'a', status: 'succeeded', imageKey: 'a.png', errorMessage: null },
        { pageNo: 6, branchKey: 'b', status: 'failed', imageKey: null, errorMessage: '실패' },
      ] as SessionPageImage[]);
      branchChoiceRepo.findOne.mockResolvedValue({ branchKey: 'a' } as SessionBranchChoice);

      const result = await service.getAfterStory(1, 'session-123');

      expect(result.firstBranchChoice).toBe('a');
      expect(result.choices[0]).toMatchObject({ branchKey: 'a', bodyText: 'A 결과', imageUrl: expect.any(String) });
      expect(result.choices[1]).toMatchObject({ branchKey: 'b', status: 'failed', errorMessage: '실패' });
    });

    it('최초 선택을 저장하고 같은 선택은 멱등 처리한다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      branchChoiceRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ branchKey: 'a' } as SessionBranchChoice);

      await expect(service.selectAfterStoryChoice(1, 'session-123', { branchKey: 'a' })).resolves.toMatchObject({ isFirstChoice: true });
      await expect(service.selectAfterStoryChoice(1, 'session-123', { branchKey: 'a' })).resolves.toMatchObject({ isFirstChoice: false });
    });

    it('다른 최초 선택으로 덮어쓰려 하면 409 도메인 오류를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      branchChoiceRepo.findOne.mockResolvedValue({ branchKey: 'a' } as SessionBranchChoice);

      await expect(service.selectAfterStoryChoice(1, 'session-123', { branchKey: 'b' })).rejects.toThrow(
        FirstBranchAlreadyChosenErrorResponseDto,
      );
    });
  });

  describe('createOrResumeSession', () => {
    it('동화가 없거나 미공개면 StoryNotFoundErrorResponseDto(404)를 던진다', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.createOrResumeSession(1, 'non-existent')).rejects.toThrow(
        StoryNotFoundErrorResponseDto,
      );
    });

    it('이미 완성(completed)된 동화는 409 (StoryAlreadyCompletedErrorResponseDto)를 던진다', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 10, slug: 'cloud-village', status: STORY_TEMPLATE_STATUS.PUBLISHED } as unknown as StoryTemplate);
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'completed',
      } as unknown as StorySession);

      await expect(service.createOrResumeSession(1, 'cloud-village')).rejects.toThrow(
        StoryAlreadyCompletedErrorResponseDto,
      );
    });

    it('미완료 세션이 이미 존재하면 새 세션을 만들지 않고 기존 세션을 반환한다 (Idempotent Resume)', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 10, slug: 'cloud-village', status: STORY_TEMPLATE_STATUS.PUBLISHED } as unknown as StoryTemplate);
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'draft',
        referenceImageKey: null,
        createdAt: new Date('2026-09-08T00:00:00Z'),
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      } as unknown as StorySession);

      const result = await service.createOrResumeSession(1, 'cloud-village');

      expect(result.id).toBe('session-123');
      expect(result.status).toBe('draft');
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('세션이 없으면 새로 생성하여 draft 상태로 반환한다', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 10, slug: 'cloud-village', status: STORY_TEMPLATE_STATUS.PUBLISHED } as unknown as StoryTemplate);
      sessionRepo.findOne.mockResolvedValue(null);
      sessionRepo.save.mockImplementation(async (entity) => ({
        ...entity,
        createdAt: new Date('2026-09-08T00:00:00Z'),
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      }));

      const result = await service.createOrResumeSession(1, 'cloud-village');

      expect(result.templateSlug).toBe('cloud-village');
      expect(result.status).toBe('draft');
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });

  describe('getMySessions', () => {
    it('사용자의 모든 세션을 조회하고 S3 서명 URL과 함께 반환한다', async () => {
      sessionRepo.find.mockResolvedValue([
        {
          id: 'session-1',
          userId: 1,
          templateId: 10,
          status: 'completed',
          referenceImageKey: 'references/session-1/ref.png',
          template: { id: 10, slug: 'red-riding-hood', title: '빨간 모자' } as unknown as StoryTemplate,
          createdAt: new Date('2026-09-08T00:00:00Z'),
          updatedAt: new Date('2026-09-08T01:00:00Z'),
        } as unknown as StorySession,
      ]);

      const result = await service.getMySessions(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
      expect(result[0].templateSlug).toBe('red-riding-hood');
      expect(result[0].referenceImageUrl).toBe('https://storage.local/references/session-1/ref.png');
      expect(mockStoragePort.getPresignedUrl).toHaveBeenCalledWith('references/session-1/ref.png');
    });
  });

  describe('deleteSession', () => {
    it('세션이 존재하지 않거나 소유자가 다르면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteSession(1, 'non-existent')).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('세션이 존재하면 페이지 이미지와 세션을 삭제한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 1,
      } as unknown as StorySession);

      await service.deleteSession(1, 'session-1');

      expect(pageImageRepo.delete).toHaveBeenCalledWith({ sessionId: 'session-1' });
      expect(sessionRepo.delete).toHaveBeenCalledWith({ id: 'session-1' });
    });
  });

  describe('uploadFace', () => {
    it('정면 사진이 없으면 FaceRequiredErrorResponseDto(400)를 던진다', async () => {
      await expect(
        service.uploadFace(1, 'session-123', { front: [] }),
      ).rejects.toThrow(FaceRequiredErrorResponseDto);
    });

    it('위조된 파일은 InvalidImageFormatErrorResponseDto(400)를 던진다', async () => {
      const fakeFile = { buffer: Buffer.from('not an image file') } as unknown as Express.Multer.File;

      await expect(
        service.uploadFace(1, 'session-123', { front: [fakeFile] }),
      ).rejects.toThrow(InvalidImageFormatErrorResponseDto);
    });

    it('세션이 없거나 다른 사용자 소유면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      const validFile = { buffer: VALID_JPEG } as unknown as Express.Multer.File;
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.uploadFace(1, 'session-not-found', { front: [validFile] }),
      ).rejects.toThrow(SessionNotFoundErrorResponseDto);
    });

    it('정상 얼굴 사진 업로드 시 레퍼런스를 생성하고 S3에 저장 후 presigned URL을 반환한다', async () => {
      const validFile = { buffer: VALID_JPEG } as unknown as Express.Multer.File;
      const session = {
        id: 'session-123',
        userId: 1,
        status: 'draft',
        referenceImageKey: null,
      } as unknown as StorySession;
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);

      const result = await service.uploadFace(1, 'session-123', { front: [validFile] });

      expect(mockImagePort.generateReference).toHaveBeenCalledWith({
        front: VALID_JPEG,
        left: undefined,
        right: undefined,
        characterPrompt: 'the charming protagonist storybook outfit',
      });
      expect(mockStoragePort.upload).toHaveBeenCalled();
      expect(mockStoragePort.getPresignedUrl).toHaveBeenCalled();
      expect(result.status).toBe('face_ready');
      expect(result.referenceImageUrl).toBe('https://storage.local/references/session-1/ref.png');
      expect(session.status).toBe('face_ready');
    });
  });

  describe('personalizeSession', () => {
    it('세션이 없거나 다른 사용자 소유면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.personalizeSession(1, 'non-existent')).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('얼굴 등록 전(draft) 상태면 FaceNotReadyErrorResponseDto(400)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        status: 'draft',
      } as unknown as StorySession);

      await expect(service.personalizeSession(1, 'session-123')).rejects.toThrow(
        FaceNotReadyErrorResponseDto,
      );
    });

    it('이미 completed 상태면 바로 완료 상태를 반환한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'completed',
      } as unknown as StorySession);
      pageRepo.find.mockResolvedValue([
        { id: 1, pageNo: 1, branchKey: 'common' } as unknown as StoryPage,
        { id: 2, pageNo: 2, branchKey: 'common' } as unknown as StoryPage,
      ]);

      const result = await service.personalizeSession(1, 'session-123');

      expect(result.status).toBe('completed');
      expect(result.totalPages).toBe(2);
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('face_ready 상태면 페이지별 레코드를 준비하고 generating 상태로 전환한다', async () => {
      const session = {
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'face_ready',
        referenceImageKey: 'ref-key',
      } as unknown as StorySession;
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      pageRepo.find.mockResolvedValue([
        { id: 1, templateId: 10, pageNo: 1, characterRole: 'main', basePrompt: 'p1' } as unknown as StoryPage,
        { id: 2, templateId: 10, pageNo: 2, characterRole: 'main', basePrompt: 'p2' } as unknown as StoryPage,
      ]);
      pageImageRepo.find.mockResolvedValue([]);
      pageImageRepo.create.mockImplementation((dto) => dto as unknown as SessionPageImage);
      pageImageRepo.save.mockImplementation(async (entity) => entity as unknown as SessionPageImage);

      const result = await service.personalizeSession(1, 'session-123');

      expect(result.status).toBe('generating');
      expect(result.totalPages).toBe(2);
      expect(pageImageRepo.save).toHaveBeenCalledTimes(2);
      expect(session.status).toBe('generating');
    });
  });

  describe('getSessionPages', () => {
    it('세션이 없으면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.getSessionPages(1, 'session-123')).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('페이지별 진행 상태와 성공한 이미지의 서명 URL을 함께 반환한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'generating',
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      } as unknown as StorySession);
      pageRepo.find.mockResolvedValue([
        { id: 1, pageNo: 1, branchKey: 'common' } as unknown as StoryPage,
        { id: 2, pageNo: 2, branchKey: 'common' } as unknown as StoryPage,
      ]);
      pageImageRepo.find.mockResolvedValue([
        {
          sessionId: 'session-123',
          pageNo: 1,
          branchKey: 'common',
          status: 'succeeded',
          imageKey: 'pages/p1.png',
          updatedAt: new Date('2026-09-08T00:01:00Z'),
        } as unknown as SessionPageImage,
        {
          sessionId: 'session-123',
          pageNo: 2,
          branchKey: 'common',
          status: 'pending',
          imageKey: null,
          updatedAt: new Date('2026-09-08T00:00:00Z'),
        } as unknown as SessionPageImage,
      ]);

      const result = await service.getSessionPages(1, 'session-123');

      expect(result.totalPages).toBe(2);
      expect(result.completedPages).toBe(1);
      expect(result.isMainStoryReady).toBe(false);
      expect(result.isAllCompleted).toBe(false);
      expect(result.pages[0].status).toBe('succeeded');
      expect(result.pages[0].imageUrl).toBe('https://storage.local/references/session-1/ref.png');
      expect(result.pages[1].status).toBe('pending');
      expect(result.pages[1].imageUrl).toBeNull();
    });
  });

  describe('retryPage', () => {
    it('세션이 없으면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('페이지 레코드가 없으면 PageNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.findOne.mockResolvedValue(null);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        PageNotFoundErrorResponseDto,
      );
    });

    it('실패(failed) 상태가 아닌 페이지를 재시도하면 PageNotFailedErrorResponseDto(400)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.findOne.mockResolvedValue({
        sessionId: 'session-123',
        pageNo: 1,
        status: 'succeeded',
      } as SessionPageImage);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        PageNotFailedErrorResponseDto,
      );
    });

    // 레플리카 3개: 살아 있는 작업을 재시도로 빼앗으면 같은 삽화가 두 번 생성된다(유료 2회).
    it('다른 인스턴스가 생성 중인(running) 페이지는 재시도를 거절한다 ⭐', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.findOne.mockResolvedValue({
        sessionId: 'session-123',
        pageNo: 1,
        status: 'running',
        updatedAt: new Date(), // 방금 갱신됨 = 살아 있다
      } as SessionPageImage);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        PageNotFailedErrorResponseDto,
      );
      expect(pageImageRepo.save).not.toHaveBeenCalled();
    });

    it('오래 멈춘(고아) running 페이지는 재시도를 허용한다', async () => {
      const session = { id: 'session-123', userId: 1 } as unknown as StorySession;
      const pageImg = {
        sessionId: 'session-123',
        pageNo: 1,
        status: 'running',
        // 11분 전 — STALE_RUNNING_MS(10분)를 넘겨 고아로 판정된다.
        updatedAt: new Date(Date.now() - 11 * 60 * 1000),
        errorMessage: null,
      } as SessionPageImage;

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      pageImageRepo.findOne.mockResolvedValue(pageImg);
      pageImageRepo.save.mockResolvedValue(pageImg);

      const result = await service.retryPage(1, 'session-123', 1);

      expect(result.status).toBe('pending');
      expect(pageImg.status).toBe('pending');
    });

    it('실패한 페이지를 재시도하면 상태를 pending으로 바꾸고 재생성을 시작한다', async () => {
      const session = {
        id: 'session-123',
        userId: 1,
        status: 'failed',
      } as unknown as StorySession;
      const pageImg = {
        sessionId: 'session-123',
        pageNo: 1,
        status: 'failed',
        errorMessage: 'Generation failed',
      } as SessionPageImage;

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      pageImageRepo.findOne.mockResolvedValue(pageImg);
      pageImageRepo.save.mockResolvedValue(pageImg);

      const result = await service.retryPage(1, 'session-123', 1);

      expect(result.pageNo).toBe(1);
      expect(result.status).toBe('pending');
      expect(pageImg.status).toBe('pending');
      expect(pageImg.errorMessage).toBeNull();
      expect(session.status).toBe('generating');
    });
  });

  // E1 회귀 방지: 레플리카 3개에서 같은 페이지가 두 번 생성되면 유료 API 가 중복 호출된다.
  // 판정은 인메모리가 아니라 `claimPage` 의 조건부 UPDATE(= affected 행 수)가 한다.
  describe('executePersonalizationPipeline — 레플리카 간 중복 생성 방지', () => {
    const session = {
      id: 'session-1',
      userId: 1,
      templateId: 10,
      referenceImageKey: 'references/session-1/ref.png',
    } as StorySession;

    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue(session);
      pageRepo.find.mockResolvedValue([
        createStoryPage({ templateId: 10, pageNo: 1, branchKey: 'common', baseImageKey: null }),
      ]);
      pageImageRepo.find.mockResolvedValue([]);
      pageImageRepo.findOne.mockResolvedValue({
        id: 'img-1',
        sessionId: 'session-1',
        pageNo: 1,
        branchKey: 'common',
        status: 'running',
        imageKey: null,
        errorMessage: null,
      } as SessionPageImage);
      pageImageRepo.save.mockImplementation((entity: unknown) => Promise.resolve(entity));
    });

    it('다른 레플리카가 이미 집어간 페이지는 이미지를 생성하지 않는다 ⭐', async () => {
      // affected 0 = "내가 집지 못했다"
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(0));

      await service.executePersonalizationPipeline('session-1');

      expect(mockImagePort.generatePageIllustration).not.toHaveBeenCalled();
      expect(mockStoragePort.upload).not.toHaveBeenCalled();
    });

    it('집을 수 있는 페이지는 정확히 한 번 생성한다', async () => {
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(1));

      await service.executePersonalizationPipeline('session-1');

      expect(mockImagePort.generatePageIllustration).toHaveBeenCalledTimes(1);
    });
  });
});
