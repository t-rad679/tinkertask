import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthContext {
  userId: string;
  via: 'firebase' | 'pat';
  patId?: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!req.auth) throw new Error('CurrentUser used without FirebaseOrPatGuard');
    return req.auth;
  },
);
