import { Module } from '@nestjs/common';
import { ScopeTypesController } from './scope-types.controller';
import { ScopeTypesService } from './scope-types.service';
import { ScopeTypesRepository } from './scope-types.repository';

@Module({
  controllers: [ScopeTypesController],
  providers: [ScopeTypesService, ScopeTypesRepository],
  exports: [ScopeTypesRepository],
})
export class ScopeTypesModule {}
