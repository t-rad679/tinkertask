import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private svc: TasksService, private repo: TasksRepository) {}

  @Get() list(@CurrentUser() u: AuthContext) { return this.repo.listForUser(u.userId); }
  @Post() create(@CurrentUser() u: AuthContext, @Body() dto: CreateTaskDto) { return this.svc.create(u.userId, dto); }
  @Patch(':id') update(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) { return this.svc.update(u.userId, id, dto); }
  @Delete(':id') @HttpCode(204) async remove(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) { await this.svc.remove(u.userId, id); }
}
