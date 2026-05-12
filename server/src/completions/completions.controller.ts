import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CompletionsService } from './completions.service';
import { CompletionsRepository } from './completions.repository';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { UpdateCompletionDto } from './dto/update-completion.dto';
import { CurrentUser, AuthContext } from '@/auth/user.decorator';

@Controller('completions')
export class CompletionsController {
  constructor(private svc: CompletionsService, private repo: CompletionsRepository) {}
  @Get() list(@CurrentUser() u: AuthContext) { return this.repo.list(u.userId); }
  @Post() create(@CurrentUser() u: AuthContext, @Body() dto: CreateCompletionDto) { return this.svc.create(u.userId, dto); }
  @Patch(':id') update(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompletionDto) { return this.svc.update(u.userId, id, dto); }
  @Delete(':id') @HttpCode(204) async remove(@CurrentUser() u: AuthContext, @Param('id', ParseUUIDPipe) id: string) { await this.svc.remove(u.userId, id); }
}
