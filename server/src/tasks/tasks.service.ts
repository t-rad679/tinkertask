import { HttpStatus, Injectable } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { TagsService } from '@/tags/tags.service';
import { ScopesRepository } from '@/scopes/scopes.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

@Injectable()
export class TasksService {
  constructor(
    private repo: TasksRepository,
    private tags: TagsService,
    private scopes: ScopesRepository,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    if ((dto.target_value == null) !== (dto.target_period == null)) {
      throw new ApiException(ErrorCodes.validation_failed, 'target_value and target_period must both be set or both null', HttpStatus.BAD_REQUEST);
    }
    if (dto.scope_id) {
      const scope = await this.scopes.findById(userId, dto.scope_id);
      if (!scope) throw new ApiException(ErrorCodes.scope_not_found, 'scope_id does not exist', HttpStatus.NOT_FOUND);
    }
    const created = await this.repo.create({
      userId,
      title: dto.title,
      body: dto.body,
      kind: dto.kind,
      scopeId: dto.scope_id ?? null,
      dueAt: dto.due_at ? new Date(dto.due_at) : null,
      recurrence: dto.recurrence ?? null,
      targetValue: dto.target_value ?? null,
      targetPeriod: dto.target_period ?? null,
    });
    if (dto.tags && dto.tags.length > 0) {
      await this.tags.replaceTaskTags(userId, created.id, dto.tags);
    }
    return created;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const current = await this.repo.findById(userId, id);
    if (!current) throw new ApiException(ErrorCodes.not_found, 'task not found', HttpStatus.NOT_FOUND);

    if (dto.scope_id) {
      const scope = await this.scopes.findById(userId, dto.scope_id);
      if (!scope) throw new ApiException(ErrorCodes.scope_not_found, 'scope_id does not exist', HttpStatus.NOT_FOUND);
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch['title'] = dto.title;
    if (dto.body !== undefined) patch['body'] = dto.body;
    if (dto.scope_id !== undefined) patch['scopeId'] = dto.scope_id;
    if (dto.due_at !== undefined) patch['dueAt'] = dto.due_at ? new Date(dto.due_at) : null;
    if (dto.recurrence !== undefined) patch['recurrence'] = dto.recurrence;
    if (dto.target_value !== undefined) patch['targetValue'] = dto.target_value;
    if (dto.target_period !== undefined) patch['targetPeriod'] = dto.target_period;
    if (dto.status !== undefined) {
      patch['status'] = dto.status;
      // Track completed_at for one-shot tasks; clear on un-complete.
      // (Habits + recurring tasks track per-occurrence completion via the completions table.)
      if (dto.status === 'completed' && current.status !== 'completed') {
        patch['completedAt'] = new Date();
      } else if (dto.status !== 'completed' && current.status === 'completed') {
        patch['completedAt'] = null;
      }
    }

    const updated = await this.repo.update(userId, id, patch as any);
    if (dto.tags !== undefined) {
      await this.tags.replaceTaskTags(userId, id, dto.tags);
    }
    return updated;
  }

  async remove(userId: string, id: string) {
    const current = await this.repo.findById(userId, id);
    if (!current) throw new ApiException(ErrorCodes.not_found, 'task not found', HttpStatus.NOT_FOUND);
    await this.repo.softDelete(userId, id);
    // Detach all task_tags so the deletion propagates via sync
    await this.tags.replaceTaskTags(userId, id, []);
  }
}
