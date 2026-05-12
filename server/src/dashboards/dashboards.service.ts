import { HttpStatus, Injectable } from '@nestjs/common';
import { DashboardsRepository } from './dashboards.repository';
import { ViewsRepository } from '@/views/views.repository';
import { ApiException } from '@/common/errors/api.exception';
import { ErrorCodes } from '@/common/errors/error-codes';

@Injectable()
export class DashboardsService {
  constructor(private repo: DashboardsRepository, private views: ViewsRepository) {}

  list(userId: string) { return this.repo.list(userId); }

  create(userId: string, name = 'Dashboard') { return this.repo.create({ userId, name }); }

  async rename(userId: string, id: string, name: string) {
    const d = await this.repo.update(userId, id, { name });
    if (!d) throw new ApiException(ErrorCodes.not_found, 'dashboard not found', HttpStatus.NOT_FOUND);
    return d;
  }

  remove(userId: string, id: string) { return this.repo.softDelete(userId, id); }

  async pin(userId: string, dashboardId: string, viewId: string, position: number) {
    const [d, v] = await Promise.all([this.repo.findById(userId, dashboardId), this.views.findById(userId, viewId)]);
    if (!d) throw new ApiException(ErrorCodes.not_found, 'dashboard not found', HttpStatus.NOT_FOUND);
    if (!v) throw new ApiException(ErrorCodes.not_found, 'view not found', HttpStatus.NOT_FOUND);
    return this.repo.pinView({ dashboardId, viewId, position });
  }

  async reorder(userId: string, dashboardId: string, viewId: string, position: number) {
    const d = await this.repo.findById(userId, dashboardId);
    if (!d) throw new ApiException(ErrorCodes.not_found, 'dashboard not found', HttpStatus.NOT_FOUND);
    const pinned = await this.repo.listPinnedViews(dashboardId);
    const row = pinned.find((p) => p.viewId === viewId);
    if (!row) throw new ApiException(ErrorCodes.not_found, 'view is not pinned on this dashboard', HttpStatus.NOT_FOUND);
    await this.repo.setPosition(row.id, position);
  }

  async unpin(userId: string, dashboardId: string, viewId: string) {
    const d = await this.repo.findById(userId, dashboardId);
    if (!d) throw new ApiException(ErrorCodes.not_found, 'dashboard not found', HttpStatus.NOT_FOUND);
    await this.repo.unpin(dashboardId, viewId);
  }
}
