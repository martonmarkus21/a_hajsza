import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CapturesService } from './captures.service';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/capture')
@UseGuards(JwtAuthGuard)
export class CapturesController {
  constructor(private readonly capturesService: CapturesService) {}

  @Post()
  async create(@Body() createCaptureDto: CreateCaptureDto, @Request() req: any) {
    return await this.capturesService.create(
      {
        ...createCaptureDto,
        userId: req.user.userId,
      },
      auditMetaFromRequest(req),
    );
  }
}

