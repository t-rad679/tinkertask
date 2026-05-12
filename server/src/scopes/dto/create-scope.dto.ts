import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateScopeDto {
  @IsUUID() scope_type_id!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsUUID() parent_id?: string;
  @IsOptional() @IsString() @Length(1, 16) color?: string;
  @IsOptional() @IsString() @Length(1, 32) icon?: string;
}
