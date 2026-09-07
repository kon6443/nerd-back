import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from '@common/guards/auth.guard';
import { User } from '@entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

/**
 * 인증 (Slice 2).
 *
 * 🚫 `AuthGuard` 를 전역(`APP_GUARD`)으로 등록하지 않는다 — 공개 라우트마다 예외를 달게 되고,
 * 예외를 깜빡한 라우트는 조용히 **열린다**. 필요한 라우트에 `@UseGuards(AuthGuard)` 로 붙인다.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, AuthGuard],
  exports: [AuthGuard, SessionService],
})
export class AuthModule {}
