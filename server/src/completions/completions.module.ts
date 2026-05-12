import { Module } from '@nestjs/common';
import { CompletionsController } from './completions.controller';
import { CompletionsService } from './completions.service';
import { CompletionsRepository } from './completions.repository';
import { TasksModule } from '@/tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [CompletionsController],
  providers: [CompletionsService, CompletionsRepository],
  exports: [CompletionsRepository],
})
export class CompletionsModule {}
