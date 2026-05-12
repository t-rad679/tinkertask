import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { TagsModule } from '@/tags/tags.module';
import { ScopesModule } from '@/scopes/scopes.module';

@Module({
  imports: [TagsModule, ScopesModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksRepository],
})
export class TasksModule {}
