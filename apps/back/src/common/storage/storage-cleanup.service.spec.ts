import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageCleanupTask } from '../../entities/storage-cleanup-task.entity';
import { STORAGE_PORT, type StoragePort } from '../port/storage.port';
import { StorageCleanupService } from './storage-cleanup.service';

describe('StorageCleanupService', () => {
  let service: StorageCleanupService;
  let mockStoragePort: jest.Mocked<StoragePort>;
  let mockCleanupTaskRepo: jest.Mocked<Repository<StorageCleanupTask>>;

  beforeEach(async () => {
    mockStoragePort = {
      upload: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
      getPresignedUrl: jest.fn(),
    };

    mockCleanupTaskRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => ({ id: 1, ...dto, retryCount: 0 })),
      save: jest.fn().mockImplementation(async (task) => task),
    } as unknown as jest.Mocked<Repository<StorageCleanupTask>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageCleanupService,
        {
          provide: STORAGE_PORT,
          useValue: mockStoragePort,
        },
        {
          provide: getRepositoryToken(StorageCleanupTask),
          useValue: mockCleanupTaskRepo,
        },
      ],
    }).compile();

    service = module.get<StorageCleanupService>(StorageCleanupService);
  });

  describe('cleanupKey', () => {
    it('빈 키나 null은 아무 작업도 하지 않는다', async () => {
      await service.cleanupKey(null);
      await service.cleanupKey('   ');

      expect(mockStoragePort.delete).not.toHaveBeenCalled();
      expect(mockCleanupTaskRepo.save).not.toHaveBeenCalled();
    });

    it('스토리지 삭제 성공 시 작업 테이블에 기록하지 않는다', async () => {
      mockStoragePort.delete.mockResolvedValueOnce(undefined);

      await service.cleanupKey('temp/source-photo/s1/photo.jpg');

      expect(mockStoragePort.delete).toHaveBeenCalledWith('temp/source-photo/s1/photo.jpg');
      expect(mockCleanupTaskRepo.save).not.toHaveBeenCalled();
    });

    it('스토리지 삭제 실패 시 영속 작업으로 기록한다', async () => {
      mockStoragePort.delete.mockRejectedValueOnce(new Error('S3 down'));

      await service.cleanupKey('temp/source-photo/s1/photo.jpg');

      expect(mockStoragePort.delete).toHaveBeenCalledWith('temp/source-photo/s1/photo.jpg');
      expect(mockCleanupTaskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          storageKey: 'temp/source-photo/s1/photo.jpg',
          status: 'pending',
          lastError: 'S3 down',
        }),
      );
      expect(mockCleanupTaskRepo.save).toHaveBeenCalled();
    });
  });

  describe('cleanupKeys', () => {
    it('여러 키 중 실패한 키만 영속 작업에 등록한다', async () => {
      mockStoragePort.delete.mockImplementation(async (key) => {
        if (key === 'fail.jpg') throw new Error('fail');
      });

      await service.cleanupKeys(['success.jpg', 'fail.jpg', null, '   ']);

      expect(mockStoragePort.delete).toHaveBeenCalledWith('success.jpg');
      expect(mockStoragePort.delete).toHaveBeenCalledWith('fail.jpg');
      expect(mockCleanupTaskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ storageKey: 'fail.jpg' }),
      );
      expect(mockCleanupTaskRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ storageKey: 'success.jpg' }),
      );
    });
  });

  describe('processPendingTasks', () => {
    it('미완료 태스크 재시도 성공 시 completed로 갱신한다', async () => {
      const pendingTask = {
        id: 1,
        storageKey: 'orphan.jpg',
        status: 'pending' as const,
        retryCount: 0,
        lastError: 'prev error',
      } as StorageCleanupTask;

      mockCleanupTaskRepo.find.mockResolvedValueOnce([pendingTask]);
      mockStoragePort.delete.mockResolvedValueOnce(undefined);

      const count = await service.processPendingTasks();

      expect(count).toBe(1);
      expect(mockStoragePort.delete).toHaveBeenCalledWith('orphan.jpg');
      expect(pendingTask.status).toBe('completed');
      expect(pendingTask.lastError).toBeNull();
      expect(mockCleanupTaskRepo.save).toHaveBeenCalledWith(pendingTask);
    });

    it('최대 재시도 횟수(5회) 초과 시 failed로 갱신한다', async () => {
      const maxRetryTask = {
        id: 2,
        storageKey: 'stuck.jpg',
        status: 'pending' as const,
        retryCount: 5,
        lastError: 'repeated error',
      } as StorageCleanupTask;

      mockCleanupTaskRepo.find.mockResolvedValueOnce([maxRetryTask]);

      const count = await service.processPendingTasks();

      expect(count).toBe(0);
      expect(mockStoragePort.delete).not.toHaveBeenCalled();
      expect(maxRetryTask.status).toBe('failed');
      expect(mockCleanupTaskRepo.save).toHaveBeenCalledWith(maxRetryTask);
    });
  });
});
