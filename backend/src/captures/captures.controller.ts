import { Controller, Post, Body, UseGuards, Request, Delete, Param } from '@nestjs/common';
import { CapturesService } from './captures.service';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/capture')
@UseGuards(JwtAuthGuard)
export class CapturesController {
  constructor(private readonly capturesService: CapturesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'officer')
  async create(@Body() createCaptureDto: CreateCaptureDto, @Request() req: any) {
    return await this.capturesService.create(
      {
        ...createCaptureDto,
      },
      req.user.userId,
      auditMetaFromRequest(req),
    );
  }

  @Delete(':pairId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'officer')
  async revertByPairId(@Param('pairId') pairId: string, @Request() req: any) {
    return await this.capturesService.revertByPairId(
      parseInt(pairId, 10),
      req.user.userId,
      auditMetaFromRequest(req),
    );
  }
}

