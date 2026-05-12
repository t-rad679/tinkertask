import { Controller, Get, Query } from '@nestjs/common';
import { IsISO8601, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncService } from './sync.service';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

class SyncQueryDto {
  @IsOptional()
  @IsISO8601()
  since?: string;
}

@Controller('sync')
export class SyncController {
  constructor(private svc: SyncService) {}

  @Get()
  sync(@CurrentUser() u: AuthContext, @Query() query: SyncQueryDto) {
    const since = query.since ? new Date(query.since) : new Date(0);
    return this.svc.delta(u.userId, since);
  }
}
