import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GameSettingsService } from './game-settings.service';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/game-settings')
export class GameSettingsController {
  constructor(
    private readonly gameSettingsService: GameSettingsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // Public endpoint for officers to get countdown
  @Get('countdown')
  @UseGuards(JwtAuthGuard)
  async getCountdown() {
    const countdown = await this.gameSettingsService.getCountdown();
    const settings = await this.gameSettingsService.getSettings();

    return {
      countdown,
      isTimerRunning: settings.isTimerRunning,
      allowPositionUpdatesForMap: settings.allowPositionUpdatesForMap ?? false,
      locationUpdateIntervalMinutes: settings.locationUpdateIntervalMinutes,
      lastLocationUpdate: settings.lastLocationUpdate
        ? new Date(settings.lastLocationUpdate).toISOString()
        : null,
    };
  }

  // Admin-only endpoint for full settings
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getSettings() {
    const settings = await this.gameSettingsService.getSettings();
    const countdown = await this.gameSettingsService.getCountdown();

    return {
      ...settings,
      countdown,
    };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateSettings(@Body() dto: UpdateGameSettingsDto, @Req() req: Request & { user: { userId: number } }) {
    const out = await this.gameSettingsService.updateSettings(dto);
    await this.auditLogsService.log({
      userId: req.user.userId,
      actionType: 'game_settings_update',
      entityType: 'game_settings',
      dataJson: dto,
      ...auditMetaFromRequest(req),
    });
    return out;
  }

  @Post('timer/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async startTimer(@Req() req: Request & { user: { userId: number } }) {
    const out = await this.gameSettingsService.startTimer();
    await this.auditLogsService.log({
      userId: req.user.userId,
      actionType: 'game_settings_timer_start',
      entityType: 'game_settings',
      dataJson: {
        nextLocationUpdate: out.nextLocationUpdate
          ? new Date(out.nextLocationUpdate).toISOString()
          : null,
      },
      ...auditMetaFromRequest(req),
    });
    return out;
  }

  @Post('timer/stop')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async stopTimer(@Req() req: Request & { user: { userId: number } }) {
    const out = await this.gameSettingsService.stopTimer();
    await this.auditLogsService.log({
      userId: req.user.userId,
      actionType: 'game_settings_timer_stop',
      entityType: 'game_settings',
      dataJson: {},
      ...auditMetaFromRequest(req),
    });
    return out;
  }
}
