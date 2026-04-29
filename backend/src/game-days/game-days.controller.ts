import { Controller, Get, Post, Body, UseGuards, Put, Param, Delete, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GameDaysService } from './game-days.service';
import { CreateGameDayDto } from './dto/create-game-day.dto';
import { UpdateGameDayDto } from './dto/update-game-day.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/game-days')
@UseGuards(JwtAuthGuard)
export class GameDaysController {
  constructor(
    private readonly gameDaysService: GameDaysService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  async findAll() {
    return await this.gameDaysService.findAll();
  }

  @Get('today')
  async findToday() {
    return await this.gameDaysService.findToday();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(
    @Body() createGameDayDto: CreateGameDayDto,
    @Req() req: Request & { user: { userId: number } },
  ) {
    const created = await this.gameDaysService.create(createGameDayDto);
    await this.auditLogsService.log({
      userId: req.user.userId,
      actionType: 'game_day_create',
      entityType: 'game_day',
      entityId: created.id,
      dataJson: createGameDayDto,
      ...auditMetaFromRequest(req),
    });
    return created;
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() updateGameDayDto: UpdateGameDayDto,
    @Req() req: Request & { user: { userId: number } },
  ) {
    const updated = await this.gameDaysService.update(parseInt(id, 10), updateGameDayDto);
    if (updated) {
      await this.auditLogsService.log({
        userId: req.user.userId,
        actionType: 'game_day_update',
        entityType: 'game_day',
        entityId: updated.id,
        dataJson: updateGameDayDto,
        ...auditMetaFromRequest(req),
      });
    }
    return updated;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string, @Req() req: Request & { user: { userId: number } }) {
    const parsedId = parseInt(id, 10);
    const out = await this.gameDaysService.delete(parsedId);
    if (out?.success) {
      await this.auditLogsService.log({
        userId: req.user.userId,
        actionType: 'game_day_delete',
        entityType: 'game_day',
        entityId: parsedId,
        dataJson: {},
        ...auditMetaFromRequest(req),
      });
    }
    return out;
  }
}
