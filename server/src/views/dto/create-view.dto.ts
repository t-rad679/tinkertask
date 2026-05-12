import { IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateViewDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsObject()
  query!: unknown;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  icon?: string;
}
