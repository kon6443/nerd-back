import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageCleanupTask } from '../../entities/storage-cleanup-task.entity';
import { STORAGE_PORT, type StoragePort } from '../port/storage.port';

const MAX_RETRY_COUNT = 5;

/**
 * 고아 스토리지 객체 삭제 및 실패 시 영속 큐를 통한 멱등 재시도 서비스.
 */
@Injectable()
export class StorageCleanupService {
  private readonly logger = new Logger(StorageCleanupService.name);

  constructor(
    @InjectRepository(StorageCleanupTask)
    private readonly cleanupTaskRepo: Repository<StorageCleanupTask>,
    @Inject(STORAGE_PORT)
    private readonly storagePort: StoragePort,
  ) {}

  /**
   * 정리해야 할 스토리지 키를 즉시 삭제 시도하고, 실패 시 영속 작업으로 기록한다.
   */
  async cleanupKey(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey || !storageKey.trim()) return;
    const trimmedKey = storageKey.trim();

    try {
      await this.storagePort.delete(trimmedKey);
      this.logger.log(`스토리지 객체 즉시 삭제 완료: ${trimmedKey}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `스토리지 객체 즉시 삭제 실패, 영속 정리 작업으로 등록: ${trimmedKey} — ${errorMsg}`,
      );
      await this.recordTask(trimmedKey, errorMsg);
    }
  }

  /**
   * 여러 스토리지 키를 병렬로 삭제하고, 실패한 키들은 영속 정리 작업으로 기록한다.
   */
  async cleanupKeys(storageKeys: (string | null | undefined)[]): Promise<void> {
    const validKeys = Array.from(
      new Set(
        storageKeys
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim()),
      ),
    );

    if (validKeys.length === 0) return;

    await Promise.allSettled(validKeys.map((key) => this.cleanupKey(key)));
  }

  /**
   * 정리 작업을 DB에 등록한다 (이미 미완료 작업이 있으면 중복 등록 방지).
   */
  async recordTask(storageKey: string, lastError?: string): Promise<StorageCleanupTask> {
    const trimmedKey = storageKey.trim();
    const existing = await this.cleanupTaskRepo.findOne({
      where: { storageKey: trimmedKey, status: 'pending' },
    });

    if (existing) {
      existing.retryCount += 1;
      if (lastError) existing.lastError = lastError;
      return await this.cleanupTaskRepo.save(existing);
    }

    const task = this.cleanupTaskRepo.create({
      storageKey: trimmedKey,
      status: 'pending',
      retryCount: 0,
      lastError: lastError ?? null,
    });

    return await this.cleanupTaskRepo.save(task);
  }

  /**
   * 미완료 정리 작업들을 재시도 처리한다.
   */
  async processPendingTasks(limit = 50): Promise<number> {
    const tasks = await this.cleanupTaskRepo.find({
      where: [
        { status: 'pending' },
        { status: 'failed' },
      ],
      order: { createdAt: 'ASC' },
      take: limit,
    });

    let successCount = 0;

    for (const task of tasks) {
      if (task.retryCount >= MAX_RETRY_COUNT) {
        task.status = 'failed';
        await this.cleanupTaskRepo.save(task);
        continue;
      }

      try {
        await this.storagePort.delete(task.storageKey);
        task.status = 'completed';
        task.lastError = null;
        await this.cleanupTaskRepo.save(task);
        successCount += 1;
      } catch (error) {
        task.retryCount += 1;
        task.lastError = error instanceof Error ? error.message : String(error);
        if (task.retryCount >= MAX_RETRY_COUNT) {
          task.status = 'failed';
        }
        await this.cleanupTaskRepo.save(task);
      }
    }

    return successCount;
  }
}
