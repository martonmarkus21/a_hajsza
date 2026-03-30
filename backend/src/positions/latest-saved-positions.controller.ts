import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/** Üldözők és adminok: legutóbbi mentett pozíció egy párhoz (pillanatkép, térkép modál). */
@Controller('api/positions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer')
export class LatestSavedPositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get('pair/:pairId/latest-saved')
  async latestSaved(@Param('pairId', ParseIntPipe) pairId: number) {
    const row = await this.positionsService.getLatestSavedPositionForPair(pairId);
    return row;
  }
}
