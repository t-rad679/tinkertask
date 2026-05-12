import { HttpStatus, Injectable } from '@nestjs/common';
import { ScopesRepository } from './scopes.repository';
import { ScopeTypesRepository } from '@/scope-types/scope-types.repository';
import { HierarchyValidator } from './hierarchy.validator';
import { CreateScopeDto } from './dto/create-scope.dto';
import { UpdateScopeDto } from './dto/update-scope.dto';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

@Injectable()
export class ScopesService {
  constructor(
    private repo: ScopesRepository,
    private typesRepo: ScopeTypesRepository,
    private validator: HierarchyValidator,
  ) {}

  async create(userId: string, dto: CreateScopeDto) {
    const types = await this.loadTypes(userId);
    let parentTypeId: string | null = null;
    if (dto.parent_id) {
      const parent = await this.repo.findById(userId, dto.parent_id);
      if (!parent) throw new ApiException(ErrorCodes.not_found, 'Parent scope not found', HttpStatus.NOT_FOUND);
      parentTypeId = parent.scopeTypeId;
    }
    this.validator.validate(types, parentTypeId, dto.scope_type_id);
    return this.repo.create({
      userId,
      scopeTypeId: dto.scope_type_id,
      parentId: dto.parent_id ?? null,
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
    });
  }

  async update(userId: string, id: string, dto: UpdateScopeDto) {
    const current = await this.repo.findById(userId, id);
    if (!current) throw new ApiException(ErrorCodes.not_found, 'scope not found', HttpStatus.NOT_FOUND);
    const nextTypeId = dto.scope_type_id ?? current.scopeTypeId;
    const nextParentId = dto.parent_id === undefined ? current.parentId : dto.parent_id;

    const types = await this.loadTypes(userId);
    let parentTypeId: string | null = null;
    if (nextParentId) {
      if (nextParentId === id) {
        throw new ApiException(ErrorCodes.invalid_scope_hierarchy, 'A scope cannot be its own parent', HttpStatus.BAD_REQUEST);
      }
      const parent = await this.repo.findById(userId, nextParentId);
      if (!parent) throw new ApiException(ErrorCodes.not_found, 'Parent scope not found', HttpStatus.NOT_FOUND);
      // Reject moves that would create a cycle (parent is a descendant of `id`)
      const descendants = await this.repo.descendantIds(userId, id);
      if (descendants.includes(nextParentId)) {
        throw new ApiException(
          ErrorCodes.invalid_scope_hierarchy,
          'Move would create a cycle (parent is a descendant of this scope)',
          HttpStatus.BAD_REQUEST,
        );
      }
      parentTypeId = parent.scopeTypeId;
    }
    this.validator.validate(types, parentTypeId, nextTypeId);

    return this.repo.update(userId, id, {
      scopeTypeId: nextTypeId,
      parentId: nextParentId ?? null,
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.repo.findById(userId, id);
    if (!current) throw new ApiException(ErrorCodes.not_found, 'scope not found', HttpStatus.NOT_FOUND);
    await this.repo.cascadeSoftDelete(userId, id);
  }

  private async loadTypes(userId: string): Promise<Map<string, { position: number }>> {
    const types = await this.typesRepo.listForUser(userId);
    return new Map(types.map((t) => [t.id, { position: t.position }]));
  }
}
