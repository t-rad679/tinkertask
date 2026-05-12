import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';
import { IsOptional, IsString, Length } from 'class-validator';

class CreateTagDto {
  @IsString() @Length(1, 60) name!: string;
  @IsOptional() @IsString() @Length(1, 16) color?: string;
}
class UpdateTagDto {
  @IsOptional() @IsString() @Length(1, 60) name?: string;
  @IsOptional() @IsString() @Length(1, 16) color?: string;
}

@Controller('tags')
export class TagsController {
  constructor(private svc: TagsService) {}

  @Get() list(@CurrentUser() u: AuthContext) { return this.svc.list(u.userId); }

  @Post() async create(@CurrentUser() u: AuthContext, @Body() dto: CreateTagDto) {
    const [id] = await this.svc.resolveNamesToIds(u.userId, [dto.name]);
    return { id };
  }

  @Patch(':id') update(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTagDto) {
    return this.svc.update(u.userId, id, dto);
  }

  @Delete(':id') @HttpCode(204) async remove(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(u.userId, id);
  }
}
