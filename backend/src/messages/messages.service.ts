import { Injectable } from '@nestjs/common';
import { FcmService } from '../fcm/fcm.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';

@Injectable()
export class MessagesService {
  constructor(
    private fcmService: FcmService,
    private auditLogsService: AuditLogsService,
  ) {}

  async sendMessage(sendMessageDto: SendMessageDto, userId: number, audit?: AuditRequestMeta) {
    if (sendMessageDto.pairId) {
      // Send to specific pair
      const result = await this.fcmService.sendToPair(sendMessageDto.pairId, {
        title: sendMessageDto.title,
        body: sendMessageDto.body,
      });

      await this.auditLogsService.log({
        userId,
        actionType: 'message_sent',
        entityType: 'pair',
        entityId: sendMessageDto.pairId,
        dataJson: { title: sendMessageDto.title, body: sendMessageDto.body },
        ...audit,
      });

      return result;
    } else {
      // Küldés minden tárolt, bejelentkezettnek számító eszközre (nem csak az utolsó 30 percben látottakra).
      const result = await this.fcmService.sendBroadcastToAllStoredDevices({
        title: sendMessageDto.title,
        body: sendMessageDto.body,
      });

      await this.auditLogsService.log({
        userId,
        actionType: 'message_sent',
        entityType: 'all_pairs',
        dataJson: { title: sendMessageDto.title, body: sendMessageDto.body },
        ...audit,
      });

      return result;
    }
  }
}





