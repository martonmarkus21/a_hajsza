import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettings } from '../entities/game-settings.entity';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { FcmService } from '../fcm/fcm.service';
import { Device } from '../entities/device.entity';

@Injectable()
export class GameSettingsService implements OnModuleInit {
  private locationUpdateTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(GameSettings)
    private gameSettingsRepository: Repository<GameSettings>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private fcmService: FcmService,
  ) {}

  async onModuleInit() {
    // Ensure there's a single game settings record
    await this.ensureGameSettings();
    
    // Restore timer if it was running
    const settings = await this.getSettings();
    if (settings.isTimerRunning && settings.nextLocationUpdate) {
      const now = new Date();
      const nextUpdate = new Date(settings.nextLocationUpdate);
      
      if (nextUpdate > now) {
        // Timer should still be running
        const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
        this.scheduleLocationUpdate(timeUntilUpdate);
      } else {
        // Timer expired, trigger update
        await this.triggerLocationUpdate();
      }
    }
  }

  private async ensureGameSettings(): Promise<GameSettings> {
    let settings = await this.gameSettingsRepository.findOne({ where: {} });
    
    if (!settings) {
      settings = this.gameSettingsRepository.create({
        locationUpdateIntervalMinutes: 20,
        isTimerRunning: false,
        lastLocationUpdate: null,
        nextLocationUpdate: null,
        allowPositionUpdatesForMap: false,
        pairsSentPositionThisCycle: null,
      });
      settings = await this.gameSettingsRepository.save(settings);
    }
    
    // Ensure allowPositionUpdatesForMap column exists (migration support)
    if (settings.allowPositionUpdatesForMap === undefined) {
      settings.allowPositionUpdatesForMap = false;
      settings = await this.gameSettingsRepository.save(settings);
    }
    
    // Ensure pairsSentPositionThisCycle column exists (migration support)
    if (settings.pairsSentPositionThisCycle === undefined) {
      settings.pairsSentPositionThisCycle = null;
      settings = await this.gameSettingsRepository.save(settings);
    }
    
    return settings;
  }

  async getSettings(): Promise<GameSettings> {
    return await this.ensureGameSettings();
  }

  async updateSettings(dto: UpdateGameSettingsDto): Promise<GameSettings> {
    const settings = await this.ensureGameSettings();
    
    if (dto.locationUpdateIntervalMinutes !== undefined) {
      settings.locationUpdateIntervalMinutes = dto.locationUpdateIntervalMinutes;
    }
    
    if (dto.isTimerRunning !== undefined) {
      settings.isTimerRunning = dto.isTimerRunning;
    }
    
    if (dto.pairsSentPositionThisCycle !== undefined) {
      settings.pairsSentPositionThisCycle = dto.pairsSentPositionThisCycle;
    }
    
    return await this.gameSettingsRepository.save(settings);
  }

  async startTimer(): Promise<GameSettings> {
    const settings = await this.ensureGameSettings();
    
    if (settings.isTimerRunning) {
      throw new Error('Timer is already running');
    }
    
    const now = new Date();
    const intervalMs = settings.locationUpdateIntervalMinutes * 60 * 1000;
    const nextUpdate = new Date(now.getTime() + intervalMs);
    
    settings.isTimerRunning = true;
    settings.nextLocationUpdate = nextUpdate;
    settings.lastLocationUpdate = null; // Reset on start
    settings.allowPositionUpdatesForMap = false; // Don't allow position updates until timer expires
    settings.pairsSentPositionThisCycle = []; // Reset tracking array
    
    await this.gameSettingsRepository.save(settings);
    
    // Schedule the update
    this.scheduleLocationUpdate(intervalMs);
    
    console.log(`[GameSettings] Timer started. Next update at: ${nextUpdate.toISOString()}`);
    
    return settings;
  }

  async stopTimer(): Promise<GameSettings> {
    const settings = await this.ensureGameSettings();
    
    if (!settings.isTimerRunning) {
      throw new Error('Timer is not running');
    }
    
    if (this.locationUpdateTimer) {
      clearTimeout(this.locationUpdateTimer);
      this.locationUpdateTimer = null;
    }
    
    settings.isTimerRunning = false;
    settings.nextLocationUpdate = null;
    
    await this.gameSettingsRepository.save(settings);
    
    console.log(`[GameSettings] Timer stopped`);
    
    return settings;
  }

  private scheduleLocationUpdate(delayMs: number) {
    if (this.locationUpdateTimer) {
      clearTimeout(this.locationUpdateTimer);
    }
    
    this.locationUpdateTimer = setTimeout(async () => {
      await this.triggerLocationUpdate();
    }, delayMs);
  }

  private async triggerLocationUpdate() {
    console.log(`[GameSettings] Triggering location update for all devices`);
    
    // Update settings FIRST - allow position updates for map and reset tracking
    const settings = await this.ensureGameSettings();
    const now = new Date();
    const intervalMs = settings.locationUpdateIntervalMinutes * 60 * 1000;
    const nextUpdate = new Date(now.getTime() + intervalMs);
    
    // CRITICAL: Set allowPositionUpdatesForMap to true when timer expires
    // Reset the tracking array so each pair can send ONE position update
    settings.allowPositionUpdatesForMap = true;
    settings.lastLocationUpdate = now;
    settings.nextLocationUpdate = nextUpdate;
    settings.pairsSentPositionThisCycle = []; // Reset - allow all pairs to send one position
    
    await this.gameSettingsRepository.save(settings);
    
    console.log(`[GameSettings] Position updates for map are now ALLOWED. Each pair can send ONE position. Next update at: ${nextUpdate.toISOString()}`);
    
    // Send FCM notification to all active devices to update their location
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const activeDevices = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.fcmToken IS NOT NULL')
      .andWhere('device.fcmToken != :empty', { empty: '' })
      .andWhere('device.lastSeenAt IS NOT NULL')
      .andWhere('device.loggedOutAt IS NULL')
      .andWhere('device.lastSeenAt > :thirtyMinutesAgo', { thirtyMinutesAgo })
      .getMany();

    for (const device of activeDevices) {
      if (device.fcmToken) {
        await this.fcmService.sendToDevice(device.fcmToken, {
          title: 'Lokációfrissítés',
          body: 'Ideje frissíteni a pozíciótokat — nyissátok meg az alkalmazást.',
          data: {
            type: 'location_update_request',
            action: 'update_location',
          },
        });
      }
    }
    
    // Schedule next update
    this.scheduleLocationUpdate(intervalMs);
    
    // NOTE: We don't close allowPositionUpdatesForMap here anymore
    // It will be closed when all pairs have sent their position (handled in positions.service.ts)
    // Or it will stay open until the next timer cycle starts (when triggerLocationUpdate is called again)
    // This ensures positions stay on the map until the next timer cycle expires
  }

  async getCountdown(): Promise<{ minutes: number; seconds: number } | null> {
    const settings = await this.ensureGameSettings();
    
    if (!settings.isTimerRunning || !settings.nextLocationUpdate) {
      return null;
    }
    
    const now = new Date();
    const nextUpdate = new Date(settings.nextLocationUpdate);
    const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
    
    if (timeUntilUpdate <= 0) {
      return { minutes: 0, seconds: 0 };
    }
    
    const totalSeconds = Math.floor(timeUntilUpdate / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return { minutes, seconds };
  }
}

