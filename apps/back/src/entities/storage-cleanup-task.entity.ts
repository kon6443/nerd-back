import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StorageCleanupStatus = 'pending' | 'completed' | 'failed';

/**
 * 삭제 실패하거나 교체된 고아 스토리지 객체를 멱등적으로 비동기 회수하는 영속 작업.
 */
@Entity('storage_cleanup_tasks')
@Index('ix_storage_cleanup_tasks_status', ['status'])
export class StorageCleanupTask {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'pending' })
  status: StorageCleanupStatus;

  @Column({ name: 'retry_count', type: 'int', unsigned: true, default: 0 })
  retryCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
