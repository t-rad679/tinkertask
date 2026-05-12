import { HttpStatus, Injectable } from '@nestjs/common';
import { ScopeTypesRepository } from './scope-types.repository';
import { CreateScopeTypeDto } from './dto/create-scope-type.dto';
import { UpdateScopeTypeDto } from './dto/update-scope-type.dto';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

@Injectable()
export class ScopeTypesService {
  constructor(private repo: ScopeTypesRepository) {}

  list(userId: string) {
    return this.repo.listForUser(userId);
  }

  create(userId: string, dto: CreateScopeTypeDto) {
    return this.repo.create({ userId, ...dto });
  }

  async update(userId: string, id: string, dto: UpdateScopeTypeDto) {
    const updated = await this.repo.update(userId, id, dto);
    if (!updated) throw new ApiException(ErrorCodes.not_found, 'scope_type not found', HttpStatus.NOT_FOUND);
    return updated;
  }

  async remove(userId: string, id: string) {
    const inUse = await this.repo.countActiveScopesUsingType(userId, id);
    if (inUse > 0) {
      throw new ApiException(
        ErrorCodes.scope_type_in_use,
        `scope_type is referenced by ${inUse} non-deleted scope(s); reassign or delete them first`,
        HttpStatus.CONFLICT,
        { in_use_count: inUse },
      );
    }
    await this.repo.softDelete(userId, id);
  }
}
