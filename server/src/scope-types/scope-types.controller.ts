import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ScopeTypesService } from './scope-types.service';
import { CreateScopeTypeDto } from './dto/create-scope-type.dto';
import { UpdateScopeTypeDto } from './dto/update-scope-type.dto';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

@Controller('scope_types')
export class ScopeTypesController {
  constructor(private svc: ScopeTypesService) {}

  @Get()
  list(@CurrentUser() user: AuthContext) {
    return this.svc.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateScopeTypeDto) {
    return this.svc.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScopeTypeDto) {
    return this.svc.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(user.userId, id);
  }
}
