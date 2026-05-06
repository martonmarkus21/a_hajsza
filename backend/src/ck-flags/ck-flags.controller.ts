import { Controller, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CkFlagsService } from './ck-flags.service';
import { CreateCkFlagDto } from './dto/create-ck-flag.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/celkereszt')
@UseGuards(JwtAuthGuard)
export class CkFlagsController {
  constructor(private readonly ckFlagsService: CkFlagsService) {}

  @Post()
  async create(@Body() createCkFlagDto: CreateCkFlagDto, @Request() req: any) {
    return await this.ckFlagsService.create(
      {
        ...createCkFlagDto,
        userId: req.user.userId,
        username: req.user.username,
      },
      auditMetaFromRequest(req),
    );
  }

  @Delete(':pairId')
  async remove(@Param('pairId') pairId: string) {
    return await this.ckFlagsService.remove(parseInt(pairId));
  }
}

