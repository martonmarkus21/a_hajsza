import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../entities/position.entity';
import { Device } from '../entities/device.entity';
import { GameSettings } from '../entities/game-settings.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';
import { GameSettingsService } from '../game-settings/game-settings.service';

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
    private gameSettingsService: GameSettingsService,
  ) {}

  async create(createPositionDto: CreatePositionDto, devicePayload?: any) {
    console.log('[Position] Received position:', {
      deviceId: createPositionDto.deviceId,
      pairId: createPositionDto.pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      devicePayload: devicePayload ? { deviceId: devicePayload.deviceId, pairId: devicePayload.pairId } : null,
    });

    // If device is authenticated via JWT, use that
    let device;
    if (devicePayload?.authenticated && devicePayload?.deviceId) {
      device = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: devicePayload.deviceId },
      });
      if (device) {
        // Update pairId from token if different
        if (devicePayload.pairId && device.pairId !== devicePayload.pairId) {
          device.pairId = devicePayload.pairId;
        }
      }
    } else {
      // Fallback: find or create device by deviceId
      device = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: createPositionDto.deviceId },
      });
    }

    if (!device) {
      // Create device if it doesn't exist
      const pairId = createPositionDto.pairId || devicePayload?.pairId;
      console.log('[Position] Creating new device with pairId:', pairId);
      device = this.deviceRepository.create({
        pairId: pairId,
        imeiOrDeviceId: createPositionDto.deviceId || devicePayload?.deviceId,
        lastSeenAt: new Date(),
      });
      device = await this.deviceRepository.save(device);
    } else {
      // Update device last seen
      device.lastSeenAt = new Date();
      // Update pairId if provided in token
      if (devicePayload?.pairId && device.pairId !== devicePayload.pairId) {
        console.log('[Position] Updating device pairId from', device.pairId, 'to', devicePayload.pairId);
        device.pairId = devicePayload.pairId;
      }
      device = await this.deviceRepository.save(device);
    }

    // Use pairId from device if not provided
    const pairId = createPositionDto.pairId || device.pairId;
    
    if (!pairId || pairId === 0) {
      console.warn('[Position] WARNING: No pairId available! Device may be logged out or pair was deleted.', {
        createPositionDtoPairId: createPositionDto.pairId,
        devicePairId: device.pairId,
        devicePayloadPairId: devicePayload?.pairId,
        deviceId: device.imeiOrDeviceId,
      });
      // Don't throw error, just return early - device needs to login again
      // This prevents HTTP 500 errors when pair is deleted
      return {
        success: false,
        message: 'PairId is required. Please login again.',
      };
    }

    console.log('[Position] Saving position for pairId:', pairId);

    // Create position - use current server time for timestamp to avoid timezone issues
    const serverTimestamp = new Date();
    const position = this.positionRepository.create({
      pairId: pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      accuracy: createPositionDto.accuracy,
      speed: createPositionDto.speed,
      vehicleMode: createPositionDto.vehicleMode || false,
      vehicleSessionRemaining: createPositionDto.vehicleSessionRemaining,
      timestamp: serverTimestamp, // Use server time instead of client time
    });

    const savedPosition = await this.positionRepository.save(position);
    console.log('[Position] Position saved successfully:', {
      id: savedPosition.id,
      pairId: savedPosition.pairId,
      lat: savedPosition.lat,
      lon: savedPosition.lon,
      timestamp: savedPosition.timestamp,
    });

    // Check for rule violations
    const violations = await this.ruleViolationsService.checkViolations(
      pairId,
      savedPosition,
    );

    // Calculate distance to nearest officer (other active pair)
    const distanceToNearestOfficer = await this.calculateDistanceToNearestOfficer(
      createPositionDto.lat,
      createPositionDto.lon,
      pairId,
    );

    // ALWAYS broadcast distance updates continuously (every second) for distance calculation
    // This ensures the "as-the-crow-flies" distance updates every second on the frontend
    console.log('[Position] Broadcasting distance update via WebSocket for pairId:', pairId);
    this.webSocketGateway.broadcastDistanceUpdate({
      pairId: pairId,
      lat: createPositionDto.lat,
      lon: createPositionDto.lon,
      distanceToNearestOfficer: distanceToNearestOfficer,
      timestamp: savedPosition.timestamp.toISOString(),
    });

    // Only broadcast position updates for the map when the timer allows it
    // CRITICAL: Each pair can only send ONE position update per timer cycle
    // This prevents continuous updates on the map - only the first position after timer expires is shown
    // ALWAYS reload settings from database to get the most current state (prevent stale data)
    const currentSettings = await this.gameSettingsRepository.findOne({ where: {} });
    let shouldShowOnMap = false;
    
    if (!currentSettings) {
      console.log('[Position] No game settings found, not broadcasting position update for map');
    } else if (!currentSettings.isTimerRunning) {
      console.log('[Position] Timer is not running, not broadcasting position update for map. pairId:', pairId);
    } else if (currentSettings.allowPositionUpdatesForMap !== true) {
      console.log('[Position] Position updates for map are not allowed (allowPositionUpdatesForMap = false), not broadcasting. pairId:', pairId);
    } else {
      // Timer is running AND allowPositionUpdatesForMap is true
      // Check if this pair has already sent a position in this cycle
      // CRITICAL: Reload settings again to get the most current state (prevent race conditions)
      const freshSettings = await this.gameSettingsRepository.findOne({ where: {} });
      if (!freshSettings || freshSettings.allowPositionUpdatesForMap !== true) {
        // Don't log here to avoid spam - this is expected when window is closed
      } else {
        const pairsSent = freshSettings.pairsSentPositionThisCycle;
        
        // Convert to array (simple-array type can be string or array)
        let pairsSentArray: number[] = [];
        if (pairsSent) {
          if (Array.isArray(pairsSent)) {
            pairsSentArray = pairsSent;
          } else {
            // Handle string case (simple-array stored as comma-separated string)
            const pairsSentStr = String(pairsSent);
            if (pairsSentStr.trim() !== '') {
              pairsSentArray = pairsSentStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            }
          }
        }
        
        // CRITICAL: Check if pairId is already in the array (handle both number and string comparisons)
        const pairIdInArray = pairsSentArray.some(id => Number(id) === Number(pairId));
        
        if (pairIdInArray) {
          // This pair has already sent a position in this cycle - don't show on map
          // Don't log here to avoid spam
        } else {
          // This pair hasn't sent a position yet in this cycle - allow it
          // Add to list and save atomically
          const updatedPairsSent = [...pairsSentArray, pairId];
          freshSettings.pairsSentPositionThisCycle = updatedPairsSent;
          await this.gameSettingsRepository.save(freshSettings);
          
          shouldShowOnMap = true;
          console.log('[Position] Pair position update allowed. pairId:', pairId, 'pairsSent:', updatedPairsSent);
          
          // Check if all active pairs have sent their position
          // If yes, close the window to prevent further position updates until next timer cycle
          const allActivePairs = await this.deviceRepository
            .createQueryBuilder('device')
            .where('device.pairId IS NOT NULL')
            .andWhere('device.lastSeenAt IS NOT NULL')
            .andWhere('device.lastSeenAt > :thirtyMinutesAgo', { 
              thirtyMinutesAgo: new Date(Date.now() - 30 * 60 * 1000) 
            })
            .select('DISTINCT device.pairId', 'pairId')
            .getRawMany();
          
          const activePairIds = allActivePairs.map((p: any) => p.pairId).filter((id: number) => id !== null);
          
          // Check if all active pairs have sent their position
          const allPairsSent = activePairIds.length > 0 && activePairIds.every((id: number) => updatedPairsSent.includes(id));
          
          if (allPairsSent) {
            // All active pairs have sent their position - close the window IMMEDIATELY
            // This prevents further position updates until the next timer cycle
            // But the positions already sent will stay on the map
            freshSettings.allowPositionUpdatesForMap = false;
            await this.gameSettingsRepository.save(freshSettings);
            console.log('[Position] All active pairs have sent position. Closing position update window IMMEDIATELY. Positions will stay on map until next timer cycle.');
          }
        }
      }
    }

    // Only broadcast position update for map if timer allows it and pair hasn't sent yet
    if (shouldShowOnMap) {
      console.log('[Position] Broadcasting position update for map via WebSocket for pairId:', pairId, 'received at:', savedPosition.timestamp.toISOString());
      this.webSocketGateway.broadcastPositionUpdate({
        pairId: pairId,
        lat: createPositionDto.lat,
        lon: createPositionDto.lon,
        accuracy: createPositionDto.accuracy,
        speed: createPositionDto.speed,
        timestamp: savedPosition.timestamp.toISOString(), // Use saved position timestamp (server time)
        vehicleMode: createPositionDto.vehicleMode || false,
        distanceToNearestOfficer: distanceToNearestOfficer,
      });
    } else {
      const allowUpdates = currentSettings?.allowPositionUpdatesForMap ?? false;
      const timerRunning = currentSettings?.isTimerRunning ?? false;
      console.log('[Position] Position update NOT broadcasted for map (timer not allowing or pair already sent) for pairId:', pairId, 'allowPositionUpdatesForMap:', allowUpdates, 'isTimerRunning:', timerRunning);
    }

    return {
      success: true,
      message: 'Position recorded',
      violationDetected: violations.length > 0,
      continuousMode: violations.length > 0,
    };
  }

  private async calculateDistanceToNearestOfficer(
    pairLat: number,
    pairLon: number,
    currentPairId: number,
  ): Promise<number | null> {
    // Calculate distance to nearest active pair (other pairs can be considered as "officers" in the game)
    // Get all active pairs with recent positions (within last 30 minutes), excluding current pair
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const activePositions = await this.positionRepository
      .createQueryBuilder('position')
      .innerJoin('position.pair', 'pair')
      .where('position.timestamp > :thirtyMinutesAgo', { thirtyMinutesAgo })
      .andWhere('pair.active = :active', { active: true })
      .andWhere('position.pairId != :currentPairId', { currentPairId })
      .orderBy('position.timestamp', 'DESC')
      .getMany();

    if (activePositions.length === 0) {
      // No other active pairs, return null
      return null;
    }

    // Find the minimum distance to any active pair
    let minDistance = Infinity;
    for (const position of activePositions) {
      const distance = this.haversineDistance(
        pairLat,
        pairLon,
        parseFloat(position.lat.toString()),
        parseFloat(position.lon.toString()),
      );
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance === Infinity ? null : minDistance;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

