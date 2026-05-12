import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecurrenceDto {
  @IsIn(['daily', 'weekdays', 'weekly', 'monthly', 'every_n_days']) kind!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) byweekday?: number[];
  @IsOptional() @IsInt() @Min(1) @Max(28) byday?: number;
  @IsOptional() @IsInt() @Min(1) every?: number;
}
