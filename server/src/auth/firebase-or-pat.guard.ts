import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { PatService, PAT_PREFIX } from './pat.service';
import { AllowlistService } from './allowlist.service';
import { UsersRepository } from '@/users/users.repository';
import { PatRepository } from '@/personal-access-tokens/pat.repository';
import { AuthContext } from './user.decorator';

@Injectable()
export class FirebaseOrPatGuard implements CanActivate {
  constructor(
    private firebase: FirebaseService,
    private pat: PatService,
    private allowlist: AllowlistService,
    private users: UsersRepository,
    private pats: PatRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; auth?: AuthContext }>();
    const header: string | undefined = req.headers['authorization'];
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException();
    }
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedException();

    let auth: AuthContext;

    if (token.startsWith(PAT_PREFIX)) {
      // PAT path: iterate all active PATs and bcrypt-compare each
      const candidates = await this.pats.listActive();
      let match: (typeof candidates)[number] | undefined;
      for (const c of candidates) {
        if (await this.pat.verify(token, c.tokenHash)) {
          match = c;
          break;
        }
      }
      if (!match) throw new UnauthorizedException();
      await this.pats.bumpLastUsed(match.id);
      auth = { userId: match.userId, via: 'pat', patId: match.id };
    } else {
      // Firebase path
      const decoded = await this.firebase.verifyIdToken(token).catch(() => null);
      if (!decoded) throw new UnauthorizedException();
      if (!this.allowlist.isAllowed(decoded.email ?? null)) {
        throw new ForbiddenException({
          error: {
            code: 'email_not_allowlisted',
            message: 'Email not on this instance allowlist',
          },
        });
      }
      await this.users.upsertOnFirstAuth(decoded.uid);
      auth = { userId: decoded.uid, via: 'firebase' };
    }

    req.auth = auth;
    return true;
  }
}
