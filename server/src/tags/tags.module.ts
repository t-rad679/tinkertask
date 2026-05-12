import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { TagsRepository } from './tags.repository';
import { TaskTagsRepository } from './task-tags.repository';

@Module({
  controllers: [TagsController],
  providers: [TagsService, TagsRepository, TaskTagsRepository],
  exports: [TagsService, TagsRepository, TaskTagsRepository],
})
export class TagsModule {}
