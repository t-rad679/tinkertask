import { Module } from '@nestjs/common';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';
import { ViewsRepository } from './views.repository';
import { ScopesModule } from '@/scopes/scopes.module';

@Module({
  imports: [ScopesModule],
  controllers: [ViewsController],
  providers: [ViewsService, ViewsRepository],
  exports: [ViewsRepository],
})
export class ViewsModule {}
