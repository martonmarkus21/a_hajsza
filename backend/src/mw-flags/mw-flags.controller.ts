import { Controller, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { MwFlagsService } from './mw-flags.service';
import { CreateMwFlagDto } from './dto/create-mw-flag.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/mw')
@UseGuards(JwtAuthGuard)
export class MwFlagsController {
  constructor(private readonly mwFlagsService: MwFlagsService) {}

  @Post()
  async create(@Body() createMwFlagDto: CreateMwFlagDto, @Request() req: any) {
    return await this.mwFlagsService.create(
      {
        ...createMwFlagDto,
        userId: req.user.userId,
      },
      auditMetaFromRequest(req),
    );
  }

  @Delete(':pairId')
  async remove(@Param('pairId') pairId: string) {
    return await this.mwFlagsService.remove(parseInt(pairId));
  }
}

