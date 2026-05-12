import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { IsObject } from 'class-validator';
import { ViewsService } from './views.service';
import { ViewsRepository } from './views.repository';
import { CreateViewDto } from './dto/create-view.dto';
import { UpdateViewDto } from './dto/update-view.dto';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

class RunInlineDto {
  @IsObject()
  query!: unknown;
}

@Controller('views')
export class ViewsController {
  constructor(
    private svc: ViewsService,
    private repo: ViewsRepository,
  ) {}

  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.repo.list(u.userId);
  }

  @Post()
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateViewDto) {
    return this.svc.create(u.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() u: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViewDto,
  ) {
    return this.svc.update(u.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(u.userId, id);
  }

  // NOTE: /run must be declared before /:id/run so the literal "run" is not
  // treated as a UUID segment by the router.
  @Post('run')
  runInline(@CurrentUser() u: AuthContext, @Body() dto: RunInlineDto) {
    return this.svc.runInline(u.userId, dto.query);
  }

  @Post(':id/run')
  runSaved(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.runSaved(u.userId, id);
  }
}
