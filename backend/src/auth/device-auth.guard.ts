import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
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

    const authHeader = request.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (request.body?.token) {
      token = request.body.token;
    }

    if (!token) {
      throw new UnauthorizedException('Bejelentkezés szükséges. Add meg a párszámot és a jelszót.');
    }

    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'device') {
        logVerbose('[DeviceAuthGuard] Invalid token type:', payload.type);
        throw new UnauthorizedException('Érvénytelen munkamenet-típus. Lépj be újra az alkalmazásban.');
      }
      const row = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: payload.deviceId },
        select: ['id', 'pairId', 'loggedOutAt'],
      });
      if (!row) {
        throw new UnauthorizedException('Az eszköz nincs regisztrálva, vagy a munkamenet érvénytelen. Lépj be újra.');
      }
      if (row.loggedOutAt != null) {
        throw new UnauthorizedException('A munkamenet lezárult. Lépj be újra.');
      }
      if (payload.pairId != null && row.pairId != null && Number(row.pairId) !== Number(payload.pairId)) {
        throw new UnauthorizedException('A munkamenet nem egyezik az eszközzel. Lépj be újra.');
      }
      request.device = payload;
      request.device.authenticated = true;
      return true;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      logVerbose('[DeviceAuthGuard] Token verification failed:', error?.message ?? error);
      throw new UnauthorizedException('Érvénytelen eszköz-munkamenet. Lépj be újra.');
    }
  }
}
