import { HttpStatus, Injectable } from '@nestjs/common';
import { ViewsRepository } from './views.repository';
import { validateViewQuery } from '@/shared/query/view-query.validator';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';
import { CreateViewDto } from './dto/create-view.dto';
import { UpdateViewDto } from './dto/update-view.dto';

@Injectable()
export class ViewsService {
  constructor(private repo: ViewsRepository) {}

  private mustValidate(query: unknown) {
    const r = validateViewQuery(query);
    if (!r.ok) {
      throw new ApiException(
        ErrorCodes.invalid_query,
        'view query failed validation',
        HttpStatus.BAD_REQUEST,
        { issues: r.errors },
      );
    }
    return r.value;
  }

  create(userId: string, dto: CreateViewDto) {
    const valid = this.mustValidate(dto.query);
    return this.repo.create({
      userId,
      name: dto.name,
      query: valid as Record<string, unknown>,
      color: dto.color,
      icon: dto.icon,
    });
  }

  async update(userId: string, id: string, dto: UpdateViewDto) {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.query !== undefined) {
      patch['query'] = this.mustValidate(dto.query) as Record<string, unknown>;
    }
    const v = await this.repo.update(userId, id, patch as any);
    if (!v) {
      throw new ApiException(ErrorCodes.not_found, 'view not found', HttpStatus.NOT_FOUND);
    }
    return v;
  }

  remove(userId: string, id: string) {
    return this.repo.softDelete(userId, id);
  }

  async runSaved(userId: string, id: string) {
    const v = await this.repo.findById(userId, id);
    if (!v) {
      throw new ApiException(ErrorCodes.not_found, 'view not found', HttpStatus.NOT_FOUND);
    }
    return this.repo.run(userId, v.query as any);
  }

  async runInline(userId: string, query: unknown) {
    const valid = this.mustValidate(query);
    return this.repo.run(userId, valid);
  }
}
