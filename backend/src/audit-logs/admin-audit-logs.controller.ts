import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QueryAdminAuditLogsDto } from './dto/query-admin-audit-logs.dto';
import { BulkDeleteAuditLogsDto } from './dto/bulk-delete-audit-logs.dto';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/audit-logs/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('meta')
  async meta() {
    return this.auditLogsService.listFilterMeta();
  }

  @Get('list')
  async list(@Query() query: QueryAdminAuditLogsDto) {
    return this.auditLogsService.listForAdmin(query);
  }

  @Get('export')
  async export(@Query() query: QueryAdminAuditLogsDto, @Res() res: Response) {
    const csv = await this.auditLogsService.exportCsvForAdmin(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="esemenynaplo-export.csv"');
    res.send(csv);
  }

  /** Szűrőnek megfelelő sorok, vagy teljes tábla törlése (admin). */
  @Post('bulk-delete')
  async bulkDelete(
    @Query() query: QueryAdminAuditLogsDto,
    @Body() body: BulkDeleteAuditLogsDto,
    @Req() req: Request & { user?: { userId?: number } },
  ) {
    const userId = req.user?.userId;
    const meta = auditMetaFromRequest(req);
    if (body.scope === 'all') {
      return this.auditLogsService.deleteAllForAdmin(userId, meta);
    }
    return this.auditLogsService.deleteMatchingForAdmin(query, userId, meta);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user?: { userId?: number } }) {
    const userId = req.user?.userId;
    return this.auditLogsService.deleteByIdForAdmin(id, userId, auditMetaFromRequest(req));
  }
}
