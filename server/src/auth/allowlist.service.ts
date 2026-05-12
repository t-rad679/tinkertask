import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AllowlistService {
  private readonly emails: Set<string>;
  private readonly domains: Set<string>;

  constructor(cfg: ConfigService) {
    const raw = cfg.get<string>('AUTH_EMAIL_ALLOWLIST') ?? '';
    const entries = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.emails = new Set(entries.filter((e) => !e.startsWith('@')));
    this.domains = new Set(
      entries.filter((e) => e.startsWith('@')).map((d) => d.slice(1)),
    );
  }

  isAllowed(email: string | undefined | null): boolean {
    if (!email) return false;
    const lower = email.toLowerCase();
    if (this.emails.has(lower)) return true;
    const at = lower.indexOf('@');
    if (at < 0) return false;
    return this.domains.has(lower.slice(at + 1));
  }
}
