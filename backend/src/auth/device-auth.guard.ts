import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { logVerbose } from '../common/verbose-log';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Try to get token from Authorization header or body
    const authHeader = request.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      logVerbose('[DeviceAuthGuard] Token found in Authorization header');
    } else if (request.body?.token) {
      token = request.body.token;
      logVerbose('[DeviceAuthGuard] Token found in body');
    } else {
      logVerbose('[DeviceAuthGuard] No token found in header or body');
    }

    if (!token) {
      // Fallback: allow deviceId in body for backward compatibility
      const deviceId = request.body?.deviceId || request.headers['x-device-id'];
      if (deviceId) {
        logVerbose('[DeviceAuthGuard] No token, but deviceId found:', deviceId);
        // Allow but mark as unauthenticated device
        request.device = { deviceId, authenticated: false };
        return true;
      }
      console.error('[DeviceAuthGuard] No token and no deviceId, throwing UnauthorizedException');
      throw new UnauthorizedException('Device authentication required');
    }

    try {
      const payload = this.jwtService.verify(token);
      logVerbose('[DeviceAuthGuard] Token verified, payload:', {
        deviceId: payload.deviceId,
        pairId: payload.pairId,
        type: payload.type,
      });
      if (payload.type !== 'device') {
        console.error('[DeviceAuthGuard] Invalid token type:', payload.type);
        throw new UnauthorizedException('Invalid token type');
      }
      const row = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: payload.deviceId },
        select: ['id', 'loggedOutAt'],
      });
      if (row?.loggedOutAt != null) {
        throw new UnauthorizedException('Device session ended; please log in again');
      }
      request.device = payload;
      request.device.authenticated = true;
      return true;
    } catch (error) {
      console.error('[DeviceAuthGuard] Token verification failed:', error.message);
      throw new UnauthorizedException('Invalid device token');
    }
  }
}


