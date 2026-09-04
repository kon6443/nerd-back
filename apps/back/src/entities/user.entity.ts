import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 체험하기 사용자.
 *
 * 09-04 결정: **아이디와 비밀번호만** 받는다. 이름·이메일 등을 받지 않는다 —
 * 안 받은 개인정보는 유출될 수 없다.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /** 로그인 아이디. UNIQUE. 형식은 `@nerd/contracts` 의 `loginIdSchema` 가 소유한다. */
  @Column({ name: 'login_id', type: 'varchar', length: 20 })
  loginId: string;

  /**
   * 비밀번호 해시. **`select: false`** — 선언된 컬럼은 모든 `find` 에서 SELECT 되어
   * 응답·로그로 새어나간다. 필요한 곳(로그인)에서만 명시적으로 가져온다.
   *
   * 🚫 평문·가역 암호로 저장하지 않는다. 형식은 `PasswordService` 가 소유한다.
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
