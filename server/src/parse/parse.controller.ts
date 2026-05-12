// parse.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { ParseService } from './parse.service';

class ParseDto {
  @IsString() @Length(1, 2000) text!: string;
}

@Controller('parse')
export class ParseController {
  constructor(private svc: ParseService) {}

  @Post()
  parse(@Body() dto: ParseDto) {
    return this.svc.parse(dto.text);
  }
}
