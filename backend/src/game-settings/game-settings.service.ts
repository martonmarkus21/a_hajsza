import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';

/** Persisted row + live fields from `game_runtime_state` (API / admin UI). */
export type GameSettingsView = GameSettings & {
  isTimerRunning: boolean;
  allowPositionUpdatesForMap: boolean;
  pairsSentPositionThisCycle: number[];
  lastLocationUpdate: Date | null;
  nextLocationUpdate: Date | null;
};

@Injectable()
export class GameSettingsService {
  constructor(
    @InjectRepository(GameSettings)
    private gameSettingsRepository: Repository<GameSettings>,
    private readonly gameRuntimeService: GameRuntimeService,
  ) {}

  private async ensureGameSettings(): Promise<GameSettings> {
    let settings = await this.gameSettingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.gameSettingsRepository.create({
        gameEnabled: false,
        locationUpdateIntervalMinutes: 20,
        stayRuleEnabled: false,
        stayRadiusKm: 5,
      });
      settings = await this.gameSettingsRepository.save(settings);
    }
    if (settings.gameEnabled === undefined) {
      settings.gameEnabled = false;
      settings = await this.gameSettingsRepository.save(settings);
    }
    if (settings.stayRuleEnabled === undefined) {
      settings.stayRuleEnabled = false;
      settings = await this.gameSettingsRepository.save(settings);
    }
    if (settings.stayRadiusKm == null || Number.isNaN(Number(settings.stayRadiusKm))) {
      settings.stayRadiusKm = 5;
      settings = await this.gameSettingsRepository.save(settings);
    }
    return settings;
  }

  async getSettings(): Promise<GameSettingsView> {
    const settings = await this.ensureGameSettings();
    const runtime = await this.gameRuntimeService.tick();
    const out = settings as GameSettingsView;
    out.isTimerRunning = runtime.campaignStatus === 'RUNNING';
    out.allowPositionUpdatesForMap = runtime.allowPositionUpdatesForMap;
    out.pairsSentPositionThisCycle = runtime.pairsSentPositionThisCycle ?? [];
    out.lastLocationUpdate = runtime.lastCycleTurnAt ?? null;
    out.nextLocationUpdate = runtime.currentCycleEndAt;
    return out;
  }

  async updateSettings(dto: UpdateGameSettingsDto): Promise<GameSettingsView> {
    const settings = await this.ensureGameSettings();
    if (dto.locationUpdateIntervalMinutes !== undefined) {
      settings.locationUpdateIntervalMinutes = dto.locationUpdateIntervalMinutes;
    }
    if (dto.gameEnabled !== undefined) {
      settings.gameEnabled = dto.gameEnabled;
    }
    if (dto.stayRuleEnabled !== undefined) {
      settings.stayRuleEnabled = dto.stayRuleEnabled;
    }
    if (dto.stayRadiusKm !== undefined) {
      settings.stayRadiusKm = Math.max(0.1, Math.min(500, Number(dto.stayRadiusKm) || 5));
    }
    await this.gameSettingsRepository.save(settings);
    await this.gameRuntimeService.tick();
    return await this.getSettings();
  }

  async startTimer(): Promise<GameSettingsView> {
    return await this.updateSettings({ gameEnabled: true });
  }

  async stopTimer(): Promise<GameSettingsView> {
    return await this.updateSettings({ gameEnabled: false });
  }

  async getCountdown(): Promise<{ minutes: number; seconds: number } | null> {
    const runtime = await this.gameRuntimeService.tick();
    if (runtime.campaignStatus !== 'RUNNING' || !runtime.currentCycleEndAt) {
      return null;
    }
    const now = new Date();
    const nextUpdate = new Date(runtime.currentCycleEndAt);
    const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
    if (timeUntilUpdate <= 0) {
      return { minutes: 0, seconds: 0 };
    }
    const totalSeconds = Math.floor(timeUntilUpdate / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
  }

  async getRuntimeSnapshot() {
    const context = await this.gameRuntimeService.getRuntimeContext();
    return {
      campaignStatus: context.state.campaignStatus,
      isGameActive: context.isGameActive,
      isPastLastScheduledGameEnd: context.isPastLastScheduledGameEnd,
      currentIntervalMinutes: context.intervalMinutes,
      activeGameDayId: context.state.activeGameDayId,
      allowPositionUpdatesForMap: context.state.allowPositionUpdatesForMap,
      lastCycleTurnAt: context.state.lastCycleTurnAt,
      lastMapPositionAt: context.state.lastMapPositionAt,
      currentCycleStartAt: context.state.currentCycleStartAt,
      currentCycleEndAt: context.state.currentCycleEndAt,
    };
  }
}

