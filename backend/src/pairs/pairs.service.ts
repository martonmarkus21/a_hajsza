import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Pair } from '../entities/pair.entity';
import { Position } from '../entities/position.entity';
import { Capture } from '../entities/capture.entity';
import { MwFlag } from '../entities/mw-flag.entity';
import { Device } from '../entities/device.entity';
import { CreatePairDto } from './dto/create-pair.dto';
import { UpdatePairDto } from './dto/update-pair.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FcmService } from '../fcm/fcm.service';
import { GameSettingsService } from '../game-settings/game-settings.service';

@Injectable()
export class PairsService {
  constructor(
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Capture)
    private captureRepository: Repository<Capture>,
    @InjectRepository(MwFlag)
    private mwFlagRepository: Repository<MwFlag>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private auditLogsService: AuditLogsService,
    private fcmService: FcmService,
    private gameSettingsService: GameSettingsService,
  ) {}

  async findAll(active?: boolean) {
    const query = this.pairRepository.createQueryBuilder('pair');

    if (active !== undefined) {
      query.where('pair.active = :active', { active });
    }

    const pairs = await query.getMany();

    // Get latest position and status for each pair
    const pairsWithStatus = await Promise.all(
      pairs.map(async (pair) => {
        // Check if pair has active device (logged in within last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const activeDevice = await this.deviceRepository.findOne({
          where: { pairId: pair.id },
        });

        // Device is active only if lastSeenAt is within 30 minutes
        // Don't check pair.active flag here - pair.active is just for map visibility (ON/OFF button)
        // The actual device activity is determined by lastSeenAt
        // If lastSeenAt is old (logout), device is inactive regardless of pair.active
        const hasActiveDevice = !!(activeDevice && 
          activeDevice.lastSeenAt && 
          new Date(activeDevice.lastSeenAt) > thirtyMinutesAgo);

        // Update pair.active based on hasActiveDevice
        // If device is not active (logged out or timed out), deactivate pair
        // But only if pair is currently active (don't reactivate if manually deactivated)
        // This ensures that on first load, pairs without active devices are not marked as active
        if (!hasActiveDevice && pair.active) {
          // Device is not active but pair is active - deactivate pair
          // This happens when:
          // 1. Device logged out (lastSeenAt is old)
          // 2. Device timed out (lastSeenAt is old)
          // 3. First load with no active devices
          pair.active = false;
          await this.pairRepository.save(pair);
        }
        // Note: We don't reactivate here if hasActiveDevice is true but pair.active is false
        // because that would reactivate pairs that were explicitly deactivated by ON/OFF button
        // Pair activation should only happen in devices.service.ts when device logs in

        // Only show pairs with active devices when active=true filter is used
        if (active === true && !hasActiveDevice) {
          return null;
        }

        // If active filter is not set, still return all pairs but mark inactive ones
        // This allows admin to see all pairs, but frontend can filter

        // Get the latest position for the pair
        // CRITICAL: Only return lastPosition if timer allows it AND pair has sent position this cycle
        // This prevents new users from seeing positions before the timer expires
        const lastPosition = await this.positionRepository.findOne({
          where: { pairId: pair.id },
          order: { timestamp: 'DESC' },
        });

        const isCaptured = await this.captureRepository.findOne({
          where: { pairId: pair.id },
        });

        const isMostWanted = await this.mwFlagRepository.findOne({
          where: { pairId: pair.id, active: true },
        });

        // Pair is active only if it has an active device
        // pair.active flag is controlled by ON/OFF button and only affects map visibility
        // The isActive property here reflects actual device login status, not pair.active flag
        // Frontend will filter based on both isActive (hasActiveDevice) and pair.active for map display
        const isActive = hasActiveDevice;

        // CRITICAL: Only return lastPosition if timer allows it AND pair has sent position this cycle
        // This prevents new users and admin panel from seeing positions before the timer expires
        // AND prevents seeing continuously updating positions
        let allowedLastPosition = null;
        const gameSettings = await this.gameSettingsService.getSettings();
        
        // CRITICAL: Only return lastPosition if:
        // 1. Timer is running
        // 2. Pair has sent position this cycle (pairsSentPositionThisCycle includes pair.id)
        // 3. Position timestamp is after lastLocationUpdate (current cycle)
        // 4. We only return positions from the current cycle (not continuously updating ones)
        if (lastPosition && gameSettings.isTimerRunning && gameSettings.lastLocationUpdate) {
          const pairsSent = gameSettings.pairsSentPositionThisCycle;
          
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
          
          // Check if pairId is in the array (handle both number and string comparisons)
          const pairIdInArray = pairsSentArray.some(id => Number(id) === Number(pair.id));
          
          if (pairIdInArray) {
            // This pair has sent a position in the current cycle
            // Now get the FIRST position from this cycle (the one sent when timer expired)
            // NOT the latest one (which might be continuously updating)
            const lastLocationUpdate = new Date(gameSettings.lastLocationUpdate);
            
            // Get the first position from this cycle (after lastLocationUpdate)
            const firstPositionInCycle = await this.positionRepository
              .createQueryBuilder('position')
              .where('position.pairId = :pairId', { pairId: pair.id })
              .andWhere('position.timestamp >= :lastLocationUpdate', { lastLocationUpdate })
              .orderBy('position.timestamp', 'ASC')
              .getOne();
            
            if (firstPositionInCycle) {
              // Return the FIRST position from this cycle (not the latest one)
              // This prevents continuously updating positions
              allowedLastPosition = {
                lat: parseFloat(firstPositionInCycle.lat.toString()),
                lon: parseFloat(firstPositionInCycle.lon.toString()),
                timestamp: firstPositionInCycle.timestamp.toISOString(),
              };
            }
          }
        }

        return {
          id: pair.id,
          assignedNumber: pair.assignedNumber,
          name: pair.name,
          active: isActive,
          captured: !!isCaptured,
          mostWanted: !!isMostWanted,
          hasActiveDevice: hasActiveDevice || false,
          lastPosition: allowedLastPosition,
          distanceToNearestOfficer: allowedLastPosition ? await this.calculateDistanceToNearestOfficer(
            allowedLastPosition.lat,
            allowedLastPosition.lon,
            pair.id,
          ) : null,
        };
      }),
    );

    // Filter out null values
    const filteredPairs = pairsWithStatus.filter((p) => p !== null);

    return { pairs: filteredPairs };
  }

  async create(createPairDto: CreatePairDto, userId: number) {
    // Check if assigned number already exists
    const existing = await this.pairRepository.findOne({
      where: { assignedNumber: createPairDto.assignedNumber },
    });

    if (existing) {
      throw new BadRequestException('Pair with this number already exists');
    }

    const pair = this.pairRepository.create({
      assignedNumber: createPairDto.assignedNumber,
      name: createPairDto.name || null,
      active: false, // Inactive until device logs in
    });

    const savedPair = await this.pairRepository.save(pair);

    await this.auditLogsService.log({
      userId,
      actionType: 'pair_create',
      entityType: 'pair',
      entityId: savedPair.id,
      dataJson: { assignedNumber: savedPair.assignedNumber },
    });

    return {
      success: true,
      pair: {
        id: savedPair.id,
        assignedNumber: savedPair.assignedNumber,
        name: savedPair.name,
        active: savedPair.active,
      },
    };
  }

  async update(id: number, updatePairDto: UpdatePairDto, userId: number) {
    const pair = await this.pairRepository.findOne({ where: { id } });
    if (!pair) {
      throw new BadRequestException('Pair not found');
    }

    if (updatePairDto.assignedNumber !== undefined) {
      // Check if new number already exists
      const existing = await this.pairRepository.findOne({
        where: { assignedNumber: updatePairDto.assignedNumber },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Pair with this number already exists');
      }
      pair.assignedNumber = updatePairDto.assignedNumber;
    }

    if (updatePairDto.name !== undefined) {
      pair.name = updatePairDto.name;
    }

    if (updatePairDto.active !== undefined) {
      pair.active = updatePairDto.active;
    }

    await this.pairRepository.save(pair);

    await this.auditLogsService.log({
      userId,
      actionType: 'pair_update',
      entityType: 'pair',
      entityId: id,
      dataJson: updatePairDto,
    });

    return {
      success: true,
      pair: {
        id: pair.id,
        assignedNumber: pair.assignedNumber,
        name: pair.name,
        active: pair.active,
      },
    };
  }

  async delete(id: number, userId: number) {
    const pair = await this.pairRepository.findOne({ where: { id } });
    if (!pair) {
      throw new BadRequestException('Pair not found');
    }

    // Get all devices associated with this pair before deleting
    const devices = await this.deviceRepository.find({
      where: { pairId: id },
    });
    
    // Send FCM notifications to devices before deleting them
    if (devices.length > 0) {
      for (const device of devices) {
        if (device.fcmToken) {
          try {
            await this.fcmService.sendToDevice(device.fcmToken, {
              title: 'Pár törölve',
              body: 'A párt törölték. Kérjük, jelentkezz be újra.',
              data: {
                type: 'pair_deleted',
                action: 'logout',
              },
            });
            console.log(`[Pair] Sent pair deletion FCM notification to device ${device.imeiOrDeviceId}`);
          } catch (error) {
            console.error(`[Pair] Failed to send FCM notification to device ${device.imeiOrDeviceId}:`, error);
          }
        }
      }
    }

    // Delete all devices associated with this pair
    if (devices.length > 0) {
      await this.deviceRepository.remove(devices);
      console.log(`[Pair] Deleted ${devices.length} device(s) associated with pair ${id}`);
    }

    // Delete all positions associated with this pair
    const positions = await this.positionRepository.find({
      where: { pairId: id },
    });
    
    if (positions.length > 0) {
      await this.positionRepository.remove(positions);
      console.log(`[Pair] Deleted ${positions.length} position(s) associated with pair ${id}`);
    }

    await this.pairRepository.remove(pair);

    await this.auditLogsService.log({
      userId,
      actionType: 'pair_delete',
      entityType: 'pair',
      entityId: id,
      dataJson: { assignedNumber: pair.assignedNumber },
    });

    return {
      success: true,
      message: 'Pair deleted',
    };
  }

  async updateName(id: number, name: string | null, userId: number) {
    // Handle empty string as null
    const nameToSet = name === '' || name === null || name === undefined ? null : name;
    return await this.update(id, { name: nameToSet }, userId);
  }

  private async calculateDistanceToNearestOfficer(
    pairLat: number | null,
    pairLon: number | null,
    currentPairId: number,
  ): Promise<number | null> {
    if (!pairLat || !pairLon) return null;

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

