import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Not, IsNull, QueryFailedError } from 'typeorm';
import { Device } from '../entities/device.entity';
import { Pair } from '../entities/pair.entity';
import { DeviceLoginDto } from './dto/device-login.dto';
import { JwtService } from '@nestjs/jwt';
import { FcmService } from '../fcm/fcm.service';
import { logVerbose } from '../common/verbose-log';
import { RecentDevicePairIdsService } from '../device-activity/recent-device-pair-ids.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { RedisPositionService } from '../redis/redis-position.service';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    private jwtService: JwtService,
    private fcmService: FcmService,
    private recentDevicePairIdsService: RecentDevicePairIdsService,
    private auditLogsService: AuditLogsService,
    private redisPositionService: RedisPositionService,
  ) {}

  async login(deviceLoginDto: DeviceLoginDto) {
    const pairNumber = parseInt(deviceLoginDto.username, 10);
    if (isNaN(pairNumber)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const incomingImei = String(deviceLoginDto.deviceId ?? '').trim();
    if (!incomingImei) {
      throw new UnauthorizedException('Device ID is required');
    }

    const pair = await this.pairRepository.findOne({
      where: { assignedNumber: pairNumber },
    });

    if (!pair) {
      console.error(`[Device] Pair not found for assignedNumber: ${pairNumber}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!pair.id || pair.id === null || pair.id === undefined) {
      console.error(`[Device] Pair found but pair.id is null/undefined! pair:`, JSON.stringify(pair, null, 2));
      throw new UnauthorizedException('Invalid pair: missing ID');
    }

    const validPairId = Number(pair.id);
    if (!validPairId || validPairId === 0 || isNaN(validPairId)) {
      console.error(`[Device] Invalid pair.id: ${pair.id}, type: ${typeof pair.id}, validPairId: ${validPairId}`);
      throw new UnauthorizedException('Invalid pair: invalid ID');
    }

    logVerbose(`[Device] Login attempt: pairNumber=${pairNumber}, pair.id=${pair.id}, validPairId=${validPairId}`);

    if (deviceLoginDto.password !== pairNumber.toString()) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const deviceByImei = await this.deviceRepository.findOne({
      where: { imeiOrDeviceId: incomingImei },
    });
    const deviceByPair = await this.deviceRepository.findOne({
      where: { pairId: validPairId },
    });

    if (deviceByPair && deviceByPair.imeiOrDeviceId !== incomingImei) {
      logVerbose(
        `[Device] Login rejected: pair ${validPairId} already bound to device ${deviceByPair.imeiOrDeviceId}, got ${incomingImei}`,
      );
      throw new ConflictException(
        'Ez a pár szám már egy másik eszközhöz van kötve. Csak az elsőként bejelentkezett telefon használhatja ezt a számot.',
      );
    }

    if (deviceByImei && deviceByImei.pairId !== validPairId) {
      logVerbose(
        `[Device] Login rejected: device ${incomingImei} is bound to pair ${deviceByImei.pairId}, attempted ${validPairId}`,
      );
      throw new ConflictException(
        'Ez az eszköz már egy másik pár számhoz van kötve. Válasszátok azt a számot, vagy kérjetek adminisztrátori feloldást.',
      );
    }

    let device: Device | null = null;

    if (deviceByImei && deviceByImei.pairId === validPairId) {
      if (deviceLoginDto.fcmToken) {
        await this.deviceRepository.query(
          `UPDATE devices SET pair_id = $1, last_seen_at = $2, fcm_token = $3, logged_out_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [validPairId, new Date(), deviceLoginDto.fcmToken, deviceByImei.id],
        );
      } else {
        await this.deviceRepository.query(
          `UPDATE devices SET pair_id = $1, last_seen_at = $2, logged_out_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [validPairId, new Date(), deviceByImei.id],
        );
      }
      device = await this.deviceRepository.findOne({ where: { id: deviceByImei.id } });
    } else if (!deviceByImei && !deviceByPair) {
      try {
        const insertResult = await this.deviceRepository.insert({
          pairId: validPairId,
          imeiOrDeviceId: incomingImei,
          lastSeenAt: new Date(),
          loggedOutAt: null,
          fcmToken: deviceLoginDto.fcmToken || null,
        });
        device = await this.deviceRepository.findOne({
          where: { id: insertResult.identifiers[0].id },
        });
      } catch (e) {
        const code = e instanceof QueryFailedError ? (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code : undefined;
        if (code === '23505') {
          throw new ConflictException(
            'Ez a pár szám már egy másik eszközhöz van kötve. Csak az elsőként bejelentkezett telefon használhatja ezt a számot.',
          );
        }
        throw e;
      }
      if (!device) {
        throw new UnauthorizedException('Failed to create device');
      }
    } else {
      logVerbose(`[Device] Login rejected: unexpected device state for pair ${validPairId}, imei ${incomingImei}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!device) {
      throw new UnauthorizedException('Failed to resolve device');
    }

    if (!pair.active) {
      logVerbose(`[Device] Activating pair ${validPairId} (assignedNumber: ${pair.assignedNumber})`);
      await this.pairRepository.query(
        `UPDATE pairs SET active = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
        [true, validPairId],
      );
    }

    logVerbose(`[Device] Login successful:`, {
      deviceId: device.imeiOrDeviceId,
      pairId: validPairId,
      pairNumber: pair.assignedNumber,
      pairActive: pair.active,
      deviceLastSeenAt: device.lastSeenAt,
      devicePairId: device.pairId,
    });

    this.recentDevicePairIdsService.invalidateSnapshot();

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
      loggedOutAt: d.loggedOutAt,
      hasFcmToken: !!d.fcmToken,
      active:
        d.loggedOutAt == null &&
        !!d.lastSeenAt &&
        new Date().getTime() - d.lastSeenAt.getTime() < 30 * 60 * 1000,
    }));
  }

  async findActiveDevices() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const devices = await this.deviceRepository.find({
      where: {
        lastSeenAt: MoreThan(thirtyMinutesAgo),
        loggedOutAt: IsNull(),
      },
      relations: ['pair'],
    });

    // Filter by actual device activity
    // Device is active only if:
    // 1. lastSeenAt is within 30 minutes AND
    // 2. not logged out (loggedOutAt IS NULL) AND
    // 3. pair exists
    // NOTE: We DON'T check pair.active flag here because:
    // - pair.active is controlled by ON/OFF button and only affects map visibility
    // - Device login status is determined by lastSeenAt + loggedOutAt
    const activeDevices = devices.filter((d) => {
      if (!d.pair || !d.pairId) return false;
      // Device is active if lastSeenAt is within 30 minutes (regardless of pair.active)
      // pair.active is only for map visibility, not for login status
      return (
        d.loggedOutAt == null &&
        !!d.lastSeenAt &&
        new Date(d.lastSeenAt) > thirtyMinutesAgo
      );
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

  async logout(deviceId: string, isForceLogout: boolean = false, adminUserId?: number, audit?: AuditRequestMeta) {
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
        logVerbose(`[Device] Sent force logout FCM notification to device ${deviceId}`);
      } catch (error) {
        console.error(`[Device] Failed to send force logout FCM notification:`, error);
      }
    }

    // Keep lastSeenAt = last real activity (admin "Legutóbb aktív"). Offline = loggedOutAt set.
    const lastActiveAt = device.lastSeenAt;
    const loggedOutAt = new Date();
    device.loggedOutAt = loggedOutAt;
    await this.deviceRepository.save(device);
    if (device.pairId) {
      try {
        await this.redisPositionService.deleteLivePosition(device.pairId);
        logVerbose(`[Device] Cleared Redis live position for pairId ${device.pairId} after logout`);
      } catch (e) {
        console.error('[Device] Failed to clear Redis live position on logout:', e);
      }
    }
    this.recentDevicePairIdsService.invalidateSnapshot();
    logVerbose(
      `[Device] Logout ${deviceId} (${isForceLogout ? 'force ' : ''}); lastSeenAt kept: ${lastActiveAt}`,
    );

    await this.auditLogsService.log({
      ...(adminUserId != null ? { userId: adminUserId } : {}),
      actionType: isForceLogout ? 'device_force_logout' : 'device_logout',
      entityType: 'device',
      entityId: device.id,
      dataJson: {
        imeiOrDeviceId: deviceId,
        pairId: device.pairId,
        lastActiveAt: lastActiveAt ? lastActiveAt.toISOString() : null,
        loggedOutAt: loggedOutAt.toISOString(),
      },
      ...audit,
    });

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
        (d) =>
          d.loggedOutAt == null &&
          !!d.lastSeenAt &&
          new Date(d.lastSeenAt) > thirtyMinutesAgo,
      );

      // If no other active device, deactivate the pair
      if (!hasOtherActiveDevice && device.pair.active) {
        device.pair.active = false;
        await this.pairRepository.save(device.pair);
        logVerbose(`[Device] Deactivated pair ${device.pair.id} (assignedNumber: ${device.pair.assignedNumber}) due to ${isForceLogout ? 'force ' : ''}logout`);
      }
    } else {
      logVerbose(`[Device] Device ${deviceId} has no valid pair (pairId: ${device.pairId}), skipping pair deactivation`);
    }

    return {
      success: true,
      message: isForceLogout ? 'Force logged out successfully' : 'Logged out successfully',
    };
  }

  async delete(id: number) {
    if (!Number.isFinite(id) || id < 1) {
      throw new NotFoundException('Device not found');
    }
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    await this.deviceRepository.remove(device);
    this.recentDevicePairIdsService.invalidateSnapshot();
    return { success: true, message: 'Device deleted successfully' };
  }
}

