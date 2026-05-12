import { Module } from '@nestjs/common';
import { PatRepository } from './pat.repository';
import { PatManagementService } from './pat.service';
import { PatController } from './pat.controller';
import { PatService } from '@/auth/pat.service';

/**
 * Owns the `personal_access_tokens` table's data layer.
 * Phase 2: PatRepository for FirebaseOrPatGuard.
 * Phase 11: PatManagementService + PatController for CRUD endpoints.
 *
 * Note: PatService (token generator) is provided directly here to avoid a
 * circular dependency with AuthModule, which already imports this module.
 */
@Module({
  controllers: [PatController],
  providers: [PatRepository, PatService, PatManagementService],
  exports: [PatRepository],
})
export class PersonalAccessTokensModule {}
