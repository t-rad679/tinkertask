import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCompletionDto {
  @IsUUID() task_id!: string;
  @IsDateString() completed_on!: string; // YYYY-MM-DD
  @IsOptional() @IsInt() @Min(1) value?: number;
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}
