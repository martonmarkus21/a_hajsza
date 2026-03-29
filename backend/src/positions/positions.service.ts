import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../entities/position.entity';
import { Device } from '../entities/device.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';
import { RedisPositionService } from '../redis/redis-position.service';
import { RecentDevicePairIdsService } from '../device-activity/recent-device-pair-ids.service';
import { PositionSnapshot } from './position-snapshot';
import { logVerbose } from '../common/verbose-log';
import { parsePairsSentIds } from '../common/pairs-sent.util';

@Injectable()
export class PositionsService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(GameSettings)
    private gameSettingsRepository: Repository<GameSettings>,
    private webSocketGateway: WebSocketGateway,
    private ruleViolationsService: RuleViolationsService,
    private redisPositionService: RedisPositionService,
    private recentDevicePairIdsService: RecentDevicePairIdsService,
  ) {}

  async create(createPositionDto: CreatePositionDto, devicePayload?: any) {
    logVerbose('[Position] Received position:', {
      deviceId: createPositionDto.deviceId,
      pairId: createPositionDto.pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      devicePayload: devicePayload ? { deviceId: devicePayload.deviceId, pairId: devicePayload.pairId } : null,
    });

    let device;
    if (devicePayload?.authenticated && devicePayload?.deviceId) {
      device = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: devicePayload.deviceId },
      });
      if (device) {
        if (devicePayload.pairId && device.pairId !== devicePayload.pairId) {
          device.pairId = devicePayload.pairId;
        }
      }
    } else {
      device = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: createPositionDto.deviceId },
      });
    }

    if (!device) {
      const pairId = createPositionDto.pairId || devicePayload?.pairId;
      logVerbose('[Position] Creating new device with pairId:', pairId);
      device = this.deviceRepository.create({
        pairId: pairId,
        imeiOrDeviceId: createPositionDto.deviceId || devicePayload?.deviceId,
        lastSeenAt: new Date(),
        loggedOutAt: null,
      });
      device = await this.deviceRepository.save(device);
    } else {
      device.lastSeenAt = new Date();
      if (devicePayload?.pairId && device.pairId !== devicePayload.pairId) {
        logVerbose('[Position] Updating device pairId from', device.pairId, 'to', devicePayload.pairId);
        device.pairId = devicePayload.pairId;
      }
      device = await this.deviceRepository.save(device);
    }

    this.recentDevicePairIdsService.invalidateSnapshot();

    const pairId = createPositionDto.pairId || device.pairId;

    if (!pairId || pairId === 0) {
      console.warn('[Position] WARNING: No pairId available! Device may be logged out or pair was deleted.', {
        createPositionDtoPairId: createPositionDto.pairId,
        devicePairId: device.pairId,
        devicePayloadPairId: devicePayload?.pairId,
        deviceId: device.imeiOrDeviceId,
      });
      return {
        success: false,
        message: 'PairId is required. Please login again.',
      };
    }

    const serverTimestamp = new Date();
    const snapshot: PositionSnapshot = {
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      accuracy: createPositionDto.accuracy ?? null,
      speed: createPositionDto.speed ?? null,
      vehicleMode: createPositionDto.vehicleMode || false,
      vehicleSessionRemaining: createPositionDto.vehicleSessionRemaining ?? null,
      timestamp: serverTimestamp,
    };

    await this.redisPositionService.setLivePosition(pairId, snapshot);
    logVerbose('[Position] Live position stored in Redis for pairId:', pairId);

    const { violations, gameAreaExitViolationActive } =
      await this.ruleViolationsService.checkViolations(pairId, snapshot);

    // Straight-line distance for pursuers is computed in the browser (geolocation + pair coords).
    logVerbose('[Position] Broadcasting distance update via WebSocket for pairId:', pairId);
    this.webSocketGateway.broadcastDistanceUpdate({
      pairId: pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      distanceToNearestOfficer: null,
      timestamp: serverTimestamp.toISOString(),
    });

    const currentSettings = await this.gameSettingsRepository.findOne({ where: {} });
    let shouldShowOnMap = false;
    let pairAddedToCycleThisRequest = false;

    if (!currentSettings) {
      logVerbose('[Position] No game settings found, not broadcasting position update for map');
    } else if (!currentSettings.isTimerRunning) {
      logVerbose('[Position] Timer is not running, not broadcasting position update for map. pairId:', pairId);
    } else {
      shouldShowOnMap = gameAreaExitViolationActive;

      if (currentSettings.allowPositionUpdatesForMap === true) {
        const freshSettings = await this.gameSettingsRepository.findOne({ where: {} });
        if (!freshSettings || freshSettings.allowPositionUpdatesForMap !== true) {
          // window closed concurrently
        } else {
          const pairsSentArray = parsePairsSentIds(freshSettings.pairsSentPositionThisCycle);

          const pairIdInArray = pairsSentArray.some((id) => Number(id) === Number(pairId));

          if (!pairIdInArray) {
            const updatedPairsSent = [...pairsSentArray, pairId];
            freshSettings.pairsSentPositionThisCycle = updatedPairsSent;
            await this.gameSettingsRepository.save(freshSettings);

            shouldShowOnMap = true;
            pairAddedToCycleThisRequest = true;
            logVerbose('[Position] Pair position update allowed. pairId:', pairId, 'pairsSent:', updatedPairsSent);

            const activePairIds = await this.recentDevicePairIdsService.getDistinctRecentDevicePairIds();

            const allPairsSent =
              activePairIds.length > 0 && activePairIds.every((id: number) => updatedPairsSent.includes(id));

            if (allPairsSent) {
              freshSettings.allowPositionUpdatesForMap = false;
              await this.gameSettingsRepository.save(freshSettings);
              logVerbose(
                '[Position] All active pairs have sent position. Closing position update window IMMEDIATELY. Positions will stay on map until next timer cycle.',
              );
            }
          }
        }
      } else {
        if (!gameAreaExitViolationActive) {
          logVerbose(
            '[Position] Position updates for map are not allowed (allowPositionUpdatesForMap = false). pairId:',
            pairId,
          );
        }
      }
    }

    let savedPosition: Position | null = null;
    if (pairAddedToCycleThisRequest && currentSettings?.isTimerRunning) {
      const positionRow = this.positionRepository.create({
        pairId: pairId,
        lat: createPositionDto.lat,
        lon: createPositionDto.lon,
        accuracy: createPositionDto.accuracy,
        speed: createPositionDto.speed,
        vehicleMode: createPositionDto.vehicleMode || false,
        vehicleSessionRemaining: createPositionDto.vehicleSessionRemaining,
        timestamp: serverTimestamp,
      });
      savedPosition = await this.positionRepository.save(positionRow);
      logVerbose('[Position] Sampled position persisted to PostgreSQL (counter cycle):', {
        id: savedPosition.id,
        pairId: savedPosition.pairId,
      });
    }

    const mapTimestamp = savedPosition?.timestamp?.toISOString() ?? serverTimestamp.toISOString();

    if (shouldShowOnMap) {
      logVerbose('[Position] Broadcasting position update for map via WebSocket for pairId:', pairId, 'at:', mapTimestamp);
      this.webSocketGateway.broadcastPositionUpdate({
        pairId: pairId,
        lat: createPositionDto.lat,
        lon: createPositionDto.lon,
        accuracy: createPositionDto.accuracy,
        speed: createPositionDto.speed,
        timestamp: mapTimestamp,
        vehicleMode: createPositionDto.vehicleMode || false,
        distanceToNearestOfficer: null,
      });
    } else {
      const allowUpdates = currentSettings?.allowPositionUpdatesForMap ?? false;
      const timerRunning = currentSettings?.isTimerRunning ?? false;
      logVerbose(
        '[Position] Position update NOT broadcasted for map (timer not allowing or pair already sent) for pairId:',
        pairId,
        'allowPositionUpdatesForMap:',
        allowUpdates,
        'isTimerRunning:',
        timerRunning,
      );
    }

    return {
      success: true,
      message: 'Position recorded',
      violationDetected: violations.length > 0,
      continuousMode: gameAreaExitViolationActive,
    };
  }

}
