import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { FcmModule } from '../fcm/fcm.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [FcmModule, AuditLogsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}





