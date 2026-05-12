import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator';
import { RecurrenceDto } from './recurrence.dto';

export class CreateTaskDto {
  @IsString() @Length(1, 500) title!: string;
  @IsOptional() @IsString() @Length(0, 10000) body?: string;
  @IsIn(['task', 'habit']) kind!: 'task' | 'habit';
  @IsOptional() @IsUUID() scope_id?: string | null;
  @IsOptional() @IsString() due_at?: string;
  @IsOptional() @ValidateNested() @Type(() => RecurrenceDto) recurrence?: RecurrenceDto;
  @IsOptional() @IsInt() @Min(1) target_value?: number;
  @IsOptional() @IsIn(['day', 'week']) target_period?: 'day' | 'week';
  @IsOptional() @IsArray() @ArrayMaxSize(50) tags?: string[];
}
