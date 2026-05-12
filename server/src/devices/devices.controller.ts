import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn, IsString, Length } from 'class-validator';
import { DevicesRepository } from './devices.repository';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

class RegisterDeviceDto {
  @IsString() @Length(10, 4096) fcm_token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}

@Controller('devices')
export class DevicesController {
  constructor(private repo: DevicesRepository) {}

  @Get() list(@CurrentUser() u: AuthContext) { return this.repo.list(u.userId); }
  @Post() register(@CurrentUser() u: AuthContext, @Body() dto: RegisterDeviceDto) {
    return this.repo.upsertByToken(u.userId, dto.fcm_token, dto.platform);
  }
  @Delete(':id') @HttpCode(204) async remove(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.repo.remove(u.userId, id);
  }
}
