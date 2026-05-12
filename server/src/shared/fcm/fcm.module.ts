import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { AuthModule } from '@/auth/auth.module';

@Module({ imports: [AuthModule], providers: [FcmService], exports: [FcmService] })
export class FcmModule {}
