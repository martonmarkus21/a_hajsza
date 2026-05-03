import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { GameRuntimeState } from '../entities/game-runtime-state.entity';
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

/** Admin + mobil olvasó végpontok: egy kérésben, motor tick NÉLKÜL (a tick a cron + pozíció mentés). */
export type GameControlApiBundle = {
  settingsView: GameSettingsView;
  countdown: { minutes: number; seconds: number } | null;
  runtimeSnapshot: {
    campaignStatus: string;
    isGameActive: boolean;
    isPastLastScheduledGameEnd: boolean;
    currentIntervalMinutes: number;
    activeGameDayId: number | null;
    allowPositionUpdatesForMap: boolean;
    lastCycleTurnAt: Date | null;
    lastMapPositionAt: Date | null;
    currentCycleStartAt: Date | null;
    currentCycleEndAt: Date | null;
  };
  runtimeContext: Awaited<ReturnType<GameRuntimeService['getRuntimeContext']>>;
};

@Injectable()
export class GameSettingsService {
  constructor(
    @InjectRepository(GameSettings)
    private gameSettingsRepository: Repository<GameSettings>,
    private readonly gameRuntimeService: GameRuntimeService,
  ) {}

  private async ensureGameSettings(): Promise<GameSettings> {
    let settings = await this.gameSettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
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

  materializeSettingsView(settings: GameSettings, runtime: GameRuntimeState): GameSettingsView {
    const out = settings as GameSettingsView;
    out.isTimerRunning = runtime.campaignStatus === 'RUNNING';
    out.allowPositionUpdatesForMap = runtime.allowPositionUpdatesForMap ?? false;
    out.pairsSentPositionThisCycle = runtime.pairsSentPositionThisCycle ?? [];
    out.lastLocationUpdate = runtime.lastCycleTurnAt ?? null;
    out.nextLocationUpdate = runtime.currentCycleEndAt;
    return out;
  }

  computeCountdownFromRuntimeState(runtime: GameRuntimeState): { minutes: number; seconds: number } | null {
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

  /**
   * Olvasás: nem lépteti a motort — a cron + élő pozíció frissítések tartják aktuálisan a runtime sort.
   * Korábban minden GET 1–2 tick() volt ⇒ másodpercenként full mentés/ws‑ellenőrzés.
   */
  async getSettings(): Promise<GameSettingsView> {
    const { settingsView } = await this.getReadOnlyGameControlPayload();
    return settingsView;
  }

  /**
   * Mobil + admin állapotlekérés közös költséggel — egy futam, tick nélkül.
   */
  async getReadOnlyGameControlPayload(): Promise<GameControlApiBundle> {
    const ctx = await this.gameRuntimeService.getRuntimeContext();
    /* ctx.settings betöltve a motor részéről — a második ensureGameSettings() minden polling kérésben felesleges + drága. */
    const settingsView = this.materializeSettingsView(ctx.settings, ctx.state);
    const countdown = this.computeCountdownFromRuntimeState(ctx.state);
    const runtimeSnapshot = {
      campaignStatus: ctx.state.campaignStatus,
      isGameActive: ctx.isGameActive,
      isPastLastScheduledGameEnd: ctx.isPastLastScheduledGameEnd,
      currentIntervalMinutes: ctx.intervalMinutes,
      activeGameDayId: ctx.state.activeGameDayId,
      allowPositionUpdatesForMap: ctx.state.allowPositionUpdatesForMap ?? false,
      lastCycleTurnAt: ctx.state.lastCycleTurnAt ?? null,
      lastMapPositionAt: ctx.state.lastMapPositionAt ?? null,
      currentCycleStartAt: ctx.state.currentCycleStartAt ?? null,
      currentCycleEndAt: ctx.state.currentCycleEndAt ?? null,
    };
    return { settingsView, countdown, runtimeSnapshot, runtimeContext: ctx };
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

}

