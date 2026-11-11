import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { smtpProvider } from './smtp.provider';
import { EmailService } from './email.service';
import { ResendService } from './resend.service';

@Module({
  imports: [ConfigModule],
  providers: [smtpProvider, ResendService, EmailService],
  exports: [EmailService, ResendService],
})
export class EmailModule {}
