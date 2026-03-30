import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryAdminPositionsDto } from './dto/query-admin-positions.dto';

@Controller('api/positions/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /** Mentett pozíciók (PostgreSQL), lapozva, szűrhető pár és időintervallum szerint. */
  @Get('list')
  async list(@Query() query: QueryAdminPositionsDto) {
    return this.positionsService.listPositionsForAdmin(query);
  }
}
