import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSettingsService } from './game-settings.service';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceOrOfficerJwtGuard } from '../auth/device-or-officer-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { auditMetaFromRequest } from '../common/audit-request.util';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';
import { GameDaysService } from '../game-days/game-days.service';
import { buildPairScheduleLines } from '../common/pair-schedule-hints';
import { coerceBooleanFlag } from '../common/coerce-flag.util';
import { MobileEnrollmentDeviceContextGuard } from '../mobile/mobile-enrollment-device-context.guard';
import { Capture } from '../entities/capture.entity';
import { RuleViolation } from '../entities/rule-violation.entity';

@Controller('api/game-settings')
export class GameSettingsController {
  constructor(
    private readonly gameSettingsService: GameSettingsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly gameRuntimeService: GameRuntimeService,
    private readonly gameDaysService: GameDaysService,
    @InjectRepository(Capture)
    private readonly captureRepository: Repository<Capture>,
    @InjectRepository(RuleViolation)
    private readonly ruleViolationRepository: Repository<RuleViolation>,
  ) {}

  // Páros eszköz JWT vagy webes/officer JWT
  @Get('countdown')
  @UseGuards(DeviceOrOfficerJwtGuard, MobileEnrollmentDeviceContextGuard)
  async getCountdown(@Req() req: Request & { user?: { sub?: number }; device?: { pairId?: number } }) {
    const bundle = await this.gameSettingsService.getReadOnlyGameControlPayload();
    const { countdown, settingsView: settings, runtimeSnapshot: runtime, runtimeContext: ctx } = bundle;
    const gd = ctx.gameDay;

    let nextCalendarGameDay = null as Awaited<ReturnType<GameDaysService['findEarliestFromTodayOnward']>>;
    if (gd) {
      nextCalendarGameDay = await this.gameDaysService.findEarliestStrictlyAfterCalendarDate(new Date(gd.date));
    } else {
      nextCalendarGameDay = await this.gameDaysService.findEarliestFromTodayOnward();
    }

    const todayGameDayPayload = gd
      ? {
          date: new Date(gd.date).toISOString().slice(0, 10),
          startTime: gd.startTime,
          endTime: gd.endTime,
          isFinalDay: !!(gd.specialRulesJson as Record<string, unknown> | undefined)?.isFinalDay,
        }
      : null;

    const nextGameDayPayload = nextCalendarGameDay
      ? {
          date: new Date(nextCalendarGameDay.date).toISOString().slice(0, 10),
          startTime: nextCalendarGameDay.startTime,
          endTime: nextCalendarGameDay.endTime,
        }
      : null;

    const pairScheduleLines = buildPairScheduleLines({
      gameEnabled: settings.gameEnabled === true,
      isGameActive: ctx.isGameActive,
      isPastLastScheduledGameEnd: ctx.isPastLastScheduledGameEnd,
      campaignStatus: runtime.campaignStatus ?? null,
      gameDay: gd,
      nextCalendarGameDay,
      nowMs: Date.now(),
    });

    const pairIdFromDevice =
      req.device?.pairId != null && Number.isFinite(Number(req.device.pairId))
        ? Number(req.device.pairId)
        : null;

    let pairCaptured: boolean | null = null;
    let activeRuleViolations: { violationType: string; description: string | null }[] | null = null;

    if (pairIdFromDevice != null && pairIdFromDevice > 0) {
      pairCaptured = await this.captureRepository.exist({ where: { pairId: pairIdFromDevice } });
      const violRows = await this.ruleViolationRepository.find({
        where: { pairId: pairIdFromDevice, resolved: false },
        select: ['violationType', 'description'],
        order: { createdAt: 'DESC' },
        take: 8,
      });
      activeRuleViolations = violRows.map((v) => ({
        violationType: v.violationType,
        description: v.description ?? null,
      }));
    }

    return {
      countdown,
      gameEnabled: coerceBooleanFlag(settings.gameEnabled),
      stayRuleEnabled: coerceBooleanFlag(settings.stayRuleEnabled),
      stayRadiusKm: settings.stayRadiusKm ?? 5,
      isTimerRunning: runtime.campaignStatus === 'RUNNING',
      allowPositionUpdatesForMap: runtime.allowPositionUpdatesForMap ?? false,
      locationUpdateIntervalMinutes: settings.locationUpdateIntervalMinutes,
      currentIntervalMinutes: runtime.currentIntervalMinutes,
      campaignStatus: runtime.campaignStatus,
      isGameActive: runtime.isGameActive,
      isPastLastScheduledGameEnd: runtime.isPastLastScheduledGameEnd,
      activeGameDayId: runtime.activeGameDayId,
      lastLocationUpdate: runtime.lastCycleTurnAt
        ? new Date(runtime.lastCycleTurnAt).toISOString()
        : null,
      nextLocationUpdate: runtime.currentCycleEndAt
        ? new Date(runtime.currentCycleEndAt).toISOString()
        : null,
      todayGameDay: todayGameDayPayload,
      nextGameDay: nextGameDayPayload,
      pairScheduleLines,
      pairCaptured,
      activeRuleViolations,
    };
  }

  // Admin-only endpoint for full settings
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getSettings() {
    const { settingsView, countdown, runtimeSnapshot } = await this.gameSettingsService.getReadOnlyGameControlPayload();
    return {
      ...settingsView,
      countdown,
      runtime: runtimeSnapshot,
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
      actionType: 'game_runtime_engine_start',
      entityType: 'game_runtime',
      dataJson: {
        campaignStatus: out.isTimerRunning ? 'RUNNING' : 'IDLE',
        allowPositionUpdatesForMap: out.allowPositionUpdatesForMap,
        currentIntervalMinutes: out.locationUpdateIntervalMinutes,
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
      actionType: 'game_runtime_engine_stop',
      entityType: 'game_runtime',
      dataJson: {
        campaignStatus: out.isTimerRunning ? 'RUNNING' : 'IDLE',
        allowPositionUpdatesForMap: out.allowPositionUpdatesForMap,
      },
      ...auditMetaFromRequest(req),
    });
    return out;
  }
}
