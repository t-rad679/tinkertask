import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateScopeDto {
  @IsOptional() @IsUUID() scope_type_id?: string;
  @IsOptional() @IsUUID() parent_id?: string | null;
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @Length(1, 16) color?: string;
  @IsOptional() @IsString() @Length(1, 32) icon?: string;
}
