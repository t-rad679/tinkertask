import { HttpStatus, Injectable } from '@nestjs/common';
import { CompletionsRepository } from './completions.repository';
import { TasksRepository } from '@/tasks/tasks.repository';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { UpdateCompletionDto } from './dto/update-completion.dto';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

@Injectable()
export class CompletionsService {
  constructor(private repo: CompletionsRepository, private tasks: TasksRepository) {}

  async create(userId: string, dto: CreateCompletionDto) {
    const task = await this.tasks.findById(userId, dto.task_id);
    if (!task) throw new ApiException(ErrorCodes.not_found, 'task not found', HttpStatus.NOT_FOUND);
    return this.repo.create({
      userId,
      taskId: dto.task_id,
      completedOn: dto.completed_on,
      value: dto.value ?? 1,
      notes: dto.notes ?? null,
    });
  }

  async update(userId: string, id: string, dto: UpdateCompletionDto) {
    const c = await this.repo.findById(userId, id);
    if (!c) throw new ApiException(ErrorCodes.not_found, 'completion not found', HttpStatus.NOT_FOUND);
    return this.repo.update(userId, id, dto);
  }

  async remove(userId: string, id: string) {
    await this.repo.softDelete(userId, id);
  }
}
