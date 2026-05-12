import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ScopesService } from './scopes.service';
import { ScopesRepository } from './scopes.repository';
import { CreateScopeDto } from './dto/create-scope.dto';
import { UpdateScopeDto } from './dto/update-scope.dto';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

@Controller('scopes')
export class ScopesController {
  constructor(private svc: ScopesService, private repo: ScopesRepository) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.repo.listForUser(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateScopeDto) {
    return this.svc.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScopeDto) {
    return this.svc.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(user.userId, id);
  }
}
