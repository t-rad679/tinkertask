import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { DashboardsService } from './dashboards.service';
import { DashboardsRepository } from './dashboards.repository';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

class CreateDashboardDto {
  @IsOptional() @IsString() @Length(1, 60) name?: string;
}
class RenameDashboardDto { @IsString() @Length(1, 60) name!: string; }
class PinViewDto {
  @IsUUID() view_id!: string;
  @IsInt() @Min(0) position!: number;
}
class ReorderDto { @IsInt() @Min(0) position!: number; }

@Controller('dashboards')
export class DashboardsController {
  constructor(private svc: DashboardsService, private repo: DashboardsRepository) {}

  @Get() list(@CurrentUser() u: AuthContext) { return this.repo.list(u.userId); }
  @Post() create(@CurrentUser() u: AuthContext, @Body() dto: CreateDashboardDto) { return this.svc.create(u.userId, dto.name); }
  @Patch(':id') rename(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameDashboardDto) { return this.svc.rename(u.userId, id, dto.name); }
  @Delete(':id') @HttpCode(204) async remove(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) { await this.svc.remove(u.userId, id); }

  @Get(':id/views') views(@Param('id', ParseUUIDPipe) id: string) { return this.repo.listPinnedViews(id); }
  @Post(':id/views') pin(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PinViewDto) { return this.svc.pin(u.userId, id, dto.view_id, dto.position); }
  @Patch(':id/views/:viewId') reorder(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Param('viewId', ParseUUIDPipe) viewId: string, @Body() dto: ReorderDto) { return this.svc.reorder(u.userId, id, viewId, dto.position); }
  @Delete(':id/views/:viewId') @HttpCode(204) async unpin(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Param('viewId', ParseUUIDPipe) viewId: string) {
    await this.svc.unpin(u.userId, id, viewId);
  }
}
