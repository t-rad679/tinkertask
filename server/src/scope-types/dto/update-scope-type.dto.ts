import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateScopeTypeDto {
  @IsOptional() @IsString() @Length(1, 60) name?: string;
  @IsOptional() @IsInt() @Min(1) position?: number;
  @IsOptional() @IsString() @Length(1, 16) color?: string;
  @IsOptional() @IsString() @Length(1, 32) icon?: string;
}
