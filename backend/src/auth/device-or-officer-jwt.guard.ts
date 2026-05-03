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

/**
 * Elfogadja a páros eszköz JWT-t (`type: device`) vagy a webes/officer felhasználó JWT-t.
 * A `GET /api/game-settings/countdown` így elérhető bejelentkezett párral is.
 */
@Injectable()
export class DeviceOrOfficerJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : (request.body?.token as string | undefined) ?? null;

    if (!token) {
      throw new UnauthorizedException('Bejelentkezés szükséges.');
    }

    let payload: Record<string, unknown>;
    try {
      payload = this.jwtService.verify(token) as Record<string, unknown>;
    } catch (e: unknown) {
      logVerbose('[DeviceOrOfficerJwtGuard] verify failed:', (e as Error)?.message ?? e);
      throw new UnauthorizedException('Érvénytelen vagy lejárt belépés. Lépj be újra.');
    }

    if (payload?.type === 'device') {
      const deviceId = String(payload.deviceId ?? '').trim();
      if (!deviceId) {
        throw new UnauthorizedException('Érvénytelen eszköz-token. Lépj be újra.');
      }
      const row = await this.deviceRepository.findOne({
        where: { imeiOrDeviceId: deviceId },
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
      request.device = { ...payload, authenticated: true };
      return true;
    }

    request.user = payload;
    return true;
  }
}
