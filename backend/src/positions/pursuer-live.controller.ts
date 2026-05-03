import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PursuerLocationDto } from './dto/pursuer-location.dto';
import { RedisPursuerPositionService } from '../redis/redis-pursuer-position.service';

/** Web üldöző / admin böngésző GPS — szerver távolságszámítás a játéknap végére. */
@Controller('api/positions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer')
export class PursuerLiveController {
  constructor(private readonly pursuerPos: RedisPursuerPositionService) {}

  @Post('pursuer-live')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportLive(@Body() dto: PursuerLocationDto, @Request() req: { user: { userId: number } }) {
    const userId = req.user?.userId;
    if (!userId) return;
    await this.pursuerPos.reportPosition(userId, dto.lat, dto.lon);
  }
}
