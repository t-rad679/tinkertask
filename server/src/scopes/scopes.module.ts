import { Module } from '@nestjs/common';
import { ScopesController } from './scopes.controller';
import { ScopesService } from './scopes.service';
import { ScopesRepository } from './scopes.repository';
import { HierarchyValidator } from './hierarchy.validator';
import { ScopeTypesModule } from '@/scope-types/scope-types.module';

@Module({
  imports: [ScopeTypesModule],
  controllers: [ScopesController],
  providers: [ScopesService, ScopesRepository, HierarchyValidator],
  exports: [ScopesRepository],
})
export class ScopesModule {}
