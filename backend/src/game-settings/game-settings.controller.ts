import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { GameSettingsService } from './game-settings.service';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/game-settings')
export class GameSettingsController {
  constructor(private readonly gameSettingsService: GameSettingsService) {}

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
  async updateSettings(@Body() dto: UpdateGameSettingsDto) {
    return await this.gameSettingsService.updateSettings(dto);
  }

  @Post('timer/start')
  async startTimer() {
    return await this.gameSettingsService.startTimer();
  }

  @Post('timer/stop')
  async stopTimer() {
    return await this.gameSettingsService.stopTimer();
  }
}



