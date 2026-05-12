import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { PatManagementService } from './pat.service';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

class CreatePatDto {
  @IsString() @Length(1, 100) name!: string;
}

@Controller('personal_access_tokens')
export class PatController {
  constructor(private svc: PatManagementService) {}

  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.userId);
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreatePatDto) {
    return this.svc.create(u.userId, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.revoke(u.userId, id);
  }
}
