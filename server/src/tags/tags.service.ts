import { HttpStatus, Injectable } from '@nestjs/common';
import { TagsRepository } from './tags.repository';
import { TaskTagsRepository } from './task-tags.repository';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

@Injectable()
export class TagsService {
  constructor(private tags: TagsRepository, private joins: TaskTagsRepository) {}

  list(userId: string) {
    return this.tags.listForUser(userId);
  }

  async resolveNamesToIds(userId: string, names: string[]): Promise<string[]> {
    const normalized = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (normalized.length === 0) return [];
    const existing = await this.tags.findByLowerNames(userId, normalized);
    const existingByLower = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
    const ids: string[] = [];
    for (const name of normalized) {
      const found = existingByLower.get(name.toLowerCase());
      if (found) ids.push(found.id);
      else {
        const created = await this.tags.create(userId, name);
        ids.push(created.id);
      }
    }
    return ids;
  }

  async replaceTaskTags(userId: string, taskId: string, names: string[]) {
    const desired = await this.resolveNamesToIds(userId, names);
    const current = await this.joins.activeTagIdsForTask(userId, taskId);
    const toAdd = desired.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !desired.includes(id));
    if (toAdd.length > 0) await this.joins.attach(userId, taskId, toAdd);
    if (toRemove.length > 0) await this.joins.detachByTagIds(userId, taskId, toRemove);
    if (toAdd.length > 0) await this.tags.incrementUseCount(toAdd, +1);
    if (toRemove.length > 0) await this.tags.incrementUseCount(toRemove, -1);
  }

  async update(userId: string, id: string, dto: { name?: string; color?: string }) {
    const updated = await this.tags.update(userId, id, dto);
    if (!updated) throw new ApiException(ErrorCodes.not_found, 'tag not found', HttpStatus.NOT_FOUND);
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.tags.cascadeSoftDelete(userId, id);
  }
}
