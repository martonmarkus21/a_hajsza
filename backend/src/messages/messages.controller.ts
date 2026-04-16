import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles('admin', 'officer')
  async sendMessage(@Body() sendMessageDto: SendMessageDto, @Request() req: any) {
    return await this.messagesService.sendMessage(sendMessageDto, req.user.userId, auditMetaFromRequest(req));
  }
}





