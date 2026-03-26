import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RuleViolationsService } from './rule-violations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/rule-violations')
@UseGuards(JwtAuthGuard)
export class RuleViolationsController {
  constructor(private readonly ruleViolationsService: RuleViolationsService) {}

  @Get('active-game-area')
  async getActiveGameAreaViolations() {
    return await this.ruleViolationsService.getActiveGameAreaViolations();
  }

  /** Admin: lapozott napló, keresés, szűrők, rendezés. */
  @Get('list')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async listForAdmin(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('type') violationType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;
    const resolvedFilter =
      status === 'active' || status === 'resolved' ? status : 'all';
    return this.ruleViolationsService.listViolationsForAdmin({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      violationType: violationType || 'all',
      resolvedFilter,
      search: search || undefined,
      sortBy: sortBy || 'createdAt',
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    const ok = await this.ruleViolationsService.deleteViolationById(parseInt(id, 10));
    return { success: ok };
  }
}
