import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateCompletionDto {
  @IsOptional() @IsInt() @Min(1) value?: number;
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}
