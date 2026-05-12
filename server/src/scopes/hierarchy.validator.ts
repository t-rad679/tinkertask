import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

interface TypeInfo { position: number }

@Injectable()
export class HierarchyValidator {
  validate(
    types: Map<string, TypeInfo>,
    parentTypeId: string | null,
    childTypeId: string,
  ): void {
    const childType = types.get(childTypeId);
    if (!childType) {
      throw new ApiException(
        ErrorCodes.invalid_scope_hierarchy,
        'Unknown scope_type for this scope',
        HttpStatus.BAD_REQUEST,
        { scope_type_id: childTypeId },
      );
    }
    if (parentTypeId === null) return;
    const parentType = types.get(parentTypeId);
    if (!parentType) {
      throw new ApiException(
        ErrorCodes.invalid_scope_hierarchy,
        'Parent scope_type not found',
        HttpStatus.BAD_REQUEST,
        { parent_type_id: parentTypeId },
      );
    }
    if (parentType.position >= childType.position) {
      throw new ApiException(
        ErrorCodes.invalid_scope_hierarchy,
        `Parent type position (${parentType.position}) must be < child type position (${childType.position})`,
        HttpStatus.BAD_REQUEST,
        { parent_position: parentType.position, child_position: childType.position },
      );
    }
  }
}
