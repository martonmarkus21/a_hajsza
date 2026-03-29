import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Not } from 'typeorm';
import { Device } from '../entities/device.entity';
import { Pair } from '../entities/pair.entity';
import { DeviceLoginDto } from './dto/device-login.dto';
import { JwtService } from '@nestjs/jwt';
import { FcmService } from '../fcm/fcm.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    private jwtService: JwtService,
    private fcmService: FcmService,
  ) { }

  async login(deviceLoginDto: DeviceLoginDto) {
    // Find pair by assigned number (username is pair number)
    const pairNumber = parseInt(deviceLoginDto.username);
    if (isNaN(pairNumber)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // CRITICAL: Don't load 'devices' relation to avoid TypeORM issues when saving pair
    const pair = await this.pairRepository.findOne({
      where: { assignedNumber: pairNumber },
      // Don't load relations to avoid TypeORM automatically updating devices
    });

    if (!pair) {
      console.error(`[Device] Pair not found for assignedNumber: ${pairNumber}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // CRITICAL: Validate pair.id immediately after fetching
    if (!pair.id || pair.id === null || pair.id === undefined) {
      console.error(`[Device] Pair found but pair.id is null/undefined! pair:`, JSON.stringify(pair, null, 2));
      throw new UnauthorizedException('Invalid pair: missing ID');
    }

    const validPairId = Number(pair.id);
    if (!validPairId || validPairId === 0 || isNaN(validPairId)) {
      console.error(`[Device] Invalid pair.id: ${pair.id}, type: ${typeof pair.id}, validPairId: ${validPairId}`);
      throw new UnauthorizedException('Invalid pair: invalid ID');
    }

    console.log(`[Device] Login attempt: pairNumber=${pairNumber}, pair.id=${pair.id}, validPairId=${validPairId}`);

    // Simple password check (in production, use proper device credentials)
    // For now, password is the pair number as string
    if (deviceLoginDto.password !== pairNumber.toString()) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if device with this deviceId already exists (possibly for another pair)
    // Don't load relations to avoid issues with deleted pairs
    let device = await this.deviceRepository.findOne({
      where: { imeiOrDeviceId: deviceLoginDto.deviceId },
    });

    // Check if pair has any existing devices
    const existingDeviceForPair = await this.deviceRepository.findOne({
      where: { pairId: validPairId },
    });

    if (device) {
      // Device exists - check if it's for the same pair
      // Handle null pairId (pair was deleted)
      if (device.pairId === validPairId) {
        // Device already belongs to this pair - just update it
        // Use raw query to avoid TypeORM relation issues
        if (deviceLoginDto.fcmToken) {
          await this.deviceRepository.query(
            `UPDATE devices SET pair_id = $1, last_seen_at = $2, fcm_token = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
            [validPairId, new Date(), deviceLoginDto.fcmToken, device.id]
          );
        } else {
          await this.deviceRepository.query(
            `UPDATE devices SET pair_id = $1, last_seen_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [validPairId, new Date(), device.id]
          );
        }
        device = await this.deviceRepository.findOne({ where: { id: device.id } });
      } else {
        // Device belongs to a different pair (or pair was deleted and pairId is invalid/null)
        // If pair already has a device, delete the old one and update this device
        // Otherwise, just update this device to point to the new pair
        if (existingDeviceForPair && existingDeviceForPair.id !== device.id) {
          // Pair has a different device - delete it and use this device
          console.log(`[Device] Pair ${validPairId} already has device ${existingDeviceForPair.imeiOrDeviceId}, replacing with ${device.imeiOrDeviceId}`);
          await this.deviceRepository.remove(existingDeviceForPair);
        }
        // Update device to point to this pair
        // CRITICAL: Use raw query to avoid TypeORM relation issues
        console.log(`[Device] Moving device ${device.imeiOrDeviceId} from pair ${device.pairId || 'none (deleted)'} to pair ${validPairId}`);
        if (deviceLoginDto.fcmToken) {
          await this.deviceRepository.query(
            `UPDATE devices SET pair_id = $1, last_seen_at = $2, fcm_token = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
            [validPairId, new Date(), deviceLoginDto.fcmToken, device.id]
          );
        } else {
          await this.deviceRepository.query(
            `UPDATE devices SET pair_id = $1, last_seen_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [validPairId, new Date(), device.id]
          );
        }
        device = await this.deviceRepository.findOne({ where: { id: device.id } });
      }
    } else {
      // Device doesn't exist
      if (existingDeviceForPair) {
        // Pair already has a device - update it with new deviceId
        console.log(`[Device] Pair ${validPairId} already has device ${existingDeviceForPair.imeiOrDeviceId}, updating to ${deviceLoginDto.deviceId}`);
        const newDeviceId = deviceLoginDto.deviceId || `device_${pairNumber}_${Date.now()}`;
        if (deviceLoginDto.fcmToken) {
          await this.deviceRepository.query(
            `UPDATE devices SET pair_id = $1, imei_or_device_id = $2, last_seen_at = $3, fcm_token = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
            [validPairId, newDeviceId, new Date(), deviceLoginDto.fcmToken, existingDeviceForPair.id]
          );
        } else {
          await this.deviceRepository.query(
            `UPDATE devices SET pair_id = $1, imei_or_device_id = $2, last_seen_at = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
            [validPairId, newDeviceId, new Date(), existingDeviceForPair.id]
          );
        }
        device = await this.deviceRepository.findOne({ where: { id: existingDeviceForPair.id } });
      } else {
        // Create new device - CRITICAL: pair.id must be valid number, not null
        // Use insert() instead of create()+save() to avoid relation issues
        const insertResult = await this.deviceRepository.insert({
          pairId: validPairId,
          imeiOrDeviceId: deviceLoginDto.deviceId || `device_${pairNumber}_${Date.now()}`,
          lastSeenAt: new Date(),
          fcmToken: deviceLoginDto.fcmToken || null,
        });
        // Fetch the created device
        device = await this.deviceRepository.findOne({
          where: { id: insertResult.identifiers[0].id }
        });
        if (!device) {
          throw new UnauthorizedException('Failed to create device');
        }
      }
    }

    // Activate pair when device logs in
    // CRITICAL: Use raw SQL to avoid TypeORM relation issues that set device.pair_id to null
    if (!pair.active) {
      console.log(`[Device] Activating pair ${validPairId} (assignedNumber: ${pair.assignedNumber})`);
      await this.pairRepository.query(
        `UPDATE pairs SET active = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
        [true, validPairId]
      );
    }

    console.log(`[Device] Login successful:`, {
      deviceId: device.imeiOrDeviceId,
      pairId: validPairId,
      pairNumber: pair.assignedNumber,
      pairActive: pair.active,
      deviceLastSeenAt: device.lastSeenAt,
      devicePairId: device.pairId,
    });

    // Generate JWT token
    const token = this.jwtService.sign({
      deviceId: device.imeiOrDeviceId,
      pairId: validPairId,
      pairNumber: pair.assignedNumber,
      type: 'device',
    });

    return {
      success: true,
      token,
      device: {
        id: device.id,
        pairId: validPairId,
        pairNumber: pair.assignedNumber,
        pairName: pair.name,
      },
    };
  }

  async getDeviceInfo(deviceId: string) {
    const device = await this.deviceRepository.findOne({
      where: { imeiOrDeviceId: deviceId },
      relations: ['pair'],
    });

    if (!device) {
      throw new UnauthorizedException('Device not found');
    }

    return {
      device: {
        id: device.id,
        pairId: device.pairId,
        pairNumber: device.pair.assignedNumber,
        pairName: device.pair.name,
        lastSeenAt: device.lastSeenAt,
      },
    };
  }

  async findAll() {
    const devices = await this.deviceRepository.find({
      relations: ['pair'],
      order: { lastSeenAt: 'DESC' },
    });

    return devices.map((d) => ({
      id: d.id,
      pairId: d.pairId,
      pairNumber: d.pair.assignedNumber,
      pairName: d.pair.name,
      imeiOrDeviceId: d.imeiOrDeviceId,
      lastSeenAt: d.lastSeenAt,
      hasFcmToken: !!d.fcmToken,
      active: d.lastSeenAt && new Date().getTime() - d.lastSeenAt.getTime() < 30 * 60 * 1000, // Active if seen in last 30 min
    }));
  }

  async findActiveDevices() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const devices = await this.deviceRepository.find({
      where: {
        lastSeenAt: MoreThan(thirtyMinutesAgo),
      },
      relations: ['pair'],
    });

    // Filter by actual device activity
    // Device is active only if:
    // 1. lastSeenAt is within 30 minutes AND
    // 2. pair exists
    // NOTE: We DON'T check pair.active flag here because:
    // - pair.active is controlled by ON/OFF button and only affects map visibility
    // - Device login status is determined by lastSeenAt only
    // - If device logged out, lastSeenAt is set to old date, so it won't be returned anyway
    const activeDevices = devices.filter((d) => {
      if (!d.pair || !d.pairId) return false;
      // Device is active if lastSeenAt is within 30 minutes (regardless of pair.active)
      // pair.active is only for map visibility, not for login status
      return d.lastSeenAt && new Date(d.lastSeenAt) > thirtyMinutesAgo;
    });

    return activeDevices.map((d) => ({
      id: d.id,
      pairId: d.pairId,
      pairNumber: d.pair?.assignedNumber || 0,
      pairName: d.pair?.name || null,
      imeiOrDeviceId: d.imeiOrDeviceId,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      hasFcmToken: !!d.fcmToken,
      active: true, // All devices returned here are active
    }));
  }

  async logout(deviceId: string, isForceLogout: boolean = false) {
    const device = await this.deviceRepository.findOne({
      where: { imeiOrDeviceId: deviceId },
      relations: ['pair'],
    });

    if (!device) {
      return {
        success: true,
        message: 'Device not found',
      };
    }

    // If force logout, send FCM notification to device
    if (isForceLogout && device.fcmToken) {
      try {
        await this.fcmService.sendToDevice(device.fcmToken, {
          title: 'Kijelentkeztetés',
          body: 'Az adminisztrátor kijelentkeztetett az eszközről.',
          data: {
            type: 'force_logout',
            action: 'logout',
          },
        });
        console.log(`[Device] Sent force logout FCM notification to device ${deviceId}`);
      } catch (error) {
        console.error(`[Device] Failed to send force logout FCM notification:`, error);
      }
    }

    // Set lastSeenAt to a very old date to mark device as inactive
    // This ensures findActiveDevices won't return this device
    // The last known position is still available in the Position table for the admin panel
    const veryOldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const previousLastSeenAt = device.lastSeenAt; // Save for logging
    device.lastSeenAt = veryOldDate;
    await this.deviceRepository.save(device);
    console.log(`[Device] Set lastSeenAt to old date for device ${deviceId} due to ${isForceLogout ? 'force ' : ''}logout. Previous lastSeenAt: ${previousLastSeenAt}`);

    // Only try to deactivate pair if device has a valid pairId and pair exists
    if (device.pairId && device.pair) {
      // Check if there are other active devices for this pair
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const otherActiveDevices = await this.deviceRepository.find({
        where: {
          pairId: device.pairId,
          imeiOrDeviceId: Not(deviceId),
        },
      });

      const hasOtherActiveDevice = otherActiveDevices.some(
        (d) => d.lastSeenAt && new Date(d.lastSeenAt) > thirtyMinutesAgo,
      );

      // If no other active device, deactivate the pair
      if (!hasOtherActiveDevice && device.pair.active) {
        device.pair.active = false;
        await this.pairRepository.save(device.pair);
        console.log(`[Device] Deactivated pair ${device.pair.id} (assignedNumber: ${device.pair.assignedNumber}) due to ${isForceLogout ? 'force ' : ''}logout`);
      }
    } else {
      console.log(`[Device] Device ${deviceId} has no valid pair (pairId: ${device.pairId}), skipping pair deactivation`);
    }

    return {
      success: true,
      message: isForceLogout ? 'Force logged out successfully' : 'Logged out successfully',
    };
  }

  async delete(id: number) {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new Error('Device not found');
    }
    await this.deviceRepository.remove(device);
    return { success: true, message: 'Device deleted successfully' };
  }
}

