import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseService } from './firebase.service';
import { PatService } from './pat.service';
import { AllowlistService } from './allowlist.service';
import { FirebaseOrPatGuard } from './firebase-or-pat.guard';
import { UsersModule } from '@/users/users.module';
import { PersonalAccessTokensModule } from '@/personal-access-tokens/personal-access-tokens.module';

@Module({
  imports: [UsersModule, PersonalAccessTokensModule],
  providers: [
    FirebaseService,
    PatService,
    AllowlistService,
    FirebaseOrPatGuard,
    // useExisting (not useClass) reuses the single FirebaseOrPatGuard instance,
    // avoiding double-construction of the guard and its 5 dependencies.
    { provide: APP_GUARD, useExisting: FirebaseOrPatGuard },
  ],
  exports: [FirebaseOrPatGuard, FirebaseService, PatService, AllowlistService],
})
export class AuthModule {}
