import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { RecurrenceDto } from './recurrence.dto';

export class UpdateTaskDto {
  @IsOptional() @IsString() @Length(1, 500) title?: string;
  @IsOptional() @IsString() @Length(0, 10000) body?: string;
  @IsOptional() @IsUUID() scope_id?: string | null;
  @IsOptional() @IsString() due_at?: string | null;
  @IsOptional() @ValidateNested() @Type(() => RecurrenceDto) recurrence?: RecurrenceDto | null;
  @IsOptional() @IsInt() @Min(1) target_value?: number | null;
  @IsOptional() @IsIn(['day', 'week']) target_period?: 'day' | 'week' | null;
  @IsOptional() @IsIn(['open', 'completed', 'archived']) status?: 'open' | 'completed' | 'archived';
  @IsOptional() @IsArray() tags?: string[];
}
