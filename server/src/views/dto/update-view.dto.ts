import { IsObject, IsOptional, IsString, Length } from 'class-validator';

export class UpdateViewDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsObject()
  query?: unknown;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  icon?: string;
}
