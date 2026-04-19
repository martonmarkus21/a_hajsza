import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryAdminPositionsDto } from './dto/query-admin-positions.dto';
import { DeleteAdminPositionsByIdsDto } from './dto/delete-admin-positions-by-ids.dto';
import { auditMetaFromRequest } from '../common/audit-request.util';

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

  /** Egy pár összes mentett pozíciójának törlése az adatbázisból. */
  @Delete('pair/:pairId')
  async deleteAllForPair(
    @Param('pairId', ParseIntPipe) pairId: number,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.positionsService.deleteAllSavedPositionsForPair(pairId, {
      userId: req.user.userId,
      ...auditMetaFromRequest(req),
    });
  }

  /** Megadott mentett pozíció-ID-k törlése (mind ugyanahhoz a párhez kell tartozzon). */
  @Post('delete-by-ids')
  async deleteByIds(
    @Body() body: DeleteAdminPositionsByIdsDto,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.positionsService.deleteSavedPositionsByIdsForPair(body.pairId, body.ids, {
      userId: req.user.userId,
      ...auditMetaFromRequest(req),
    });
  }
}
