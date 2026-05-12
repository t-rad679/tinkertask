import { Injectable } from '@nestjs/common';
import { PatRepository } from './pat.repository';
import { PatService } from '@/auth/pat.service';
import { Pat } from '@/db/schema';

export interface CreatePatResult {
  id: string;
  name: string;
  token: string;
  created_at: Date;
}

@Injectable()
export class PatManagementService {
  constructor(
    private repo: PatRepository,
    private tokenSvc: PatService,
  ) {}

  async list(userId: string): Promise<Pat[]> {
    return this.repo.listForUser(userId);
  }

  async create(userId: string, name: string): Promise<CreatePatResult> {
    const token = this.tokenSvc.generateToken();
    const hash = await this.tokenSvc.hash(token);
    const pat = await this.repo.insert(userId, name, hash);
    return {
      id: pat.id,
      name: pat.name,
      token,
      created_at: pat.createdAt,
    };
  }

  async revoke(userId: string, id: string): Promise<void> {
    await this.repo.revoke(id, userId);
  }
}
