import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Try to get token from Authorization header or body
    const authHeader = request.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('[DeviceAuthGuard] Token found in Authorization header');
    } else if (request.body?.token) {
      token = request.body.token;
      console.log('[DeviceAuthGuard] Token found in body');
    } else {
      console.log('[DeviceAuthGuard] No token found in header or body');
    }

    if (!token) {
      // Fallback: allow deviceId in body for backward compatibility
      const deviceId = request.body?.deviceId || request.headers['x-device-id'];
      if (deviceId) {
        console.log('[DeviceAuthGuard] No token, but deviceId found:', deviceId);
        // Allow but mark as unauthenticated device
        request.device = { deviceId, authenticated: false };
        return true;
      }
      console.error('[DeviceAuthGuard] No token and no deviceId, throwing UnauthorizedException');
      throw new UnauthorizedException('Device authentication required');
    }

    try {
      const payload = this.jwtService.verify(token);
      console.log('[DeviceAuthGuard] Token verified, payload:', { 
        deviceId: payload.deviceId, 
        pairId: payload.pairId, 
        type: payload.type 
      });
      if (payload.type !== 'device') {
        console.error('[DeviceAuthGuard] Invalid token type:', payload.type);
        throw new UnauthorizedException('Invalid token type');
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


