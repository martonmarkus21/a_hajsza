import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { GameAreaService } from './game-area.service';
import { UpdateGameAreaDto } from './dto/update-game-area.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/game-area')
@UseGuards(JwtAuthGuard)
export class GameAreaController {
  constructor(private readonly gameAreaService: GameAreaService) {}

  @Get()
  async getGameArea() {
    return await this.gameAreaService.getGameArea();
  }

  @Get('counties')
  async getCounties() {
    return await this.gameAreaService.getAvailableCounties();
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateGameArea(@Body() updateGameAreaDto: UpdateGameAreaDto, @Request() req: any) {
    return await this.gameAreaService.updateGameArea(
      updateGameAreaDto,
      req.user?.userId,
      auditMetaFromRequest(req),
    );
  }
}


