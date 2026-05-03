import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { MobileEnrollmentService } from './mobile-enrollment.service';

/**
 * Csak páros eszköz JWT esetén követeli a mobil titkot (pl. countdown).
 * Officer / admin webes JWT-nél nem fut ellenőrzés.
 */
@Injectable()
export class MobileEnrollmentDeviceContextGuard implements CanActivate {
  constructor(private readonly mobileEnrollment: MobileEnrollmentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.mobileEnrollment.isEnforcementEnabled())) {
      return true;
    }
    const req = context.switchToHttp().getRequest();
    if (req.device) {
      await this.mobileEnrollment.assertValidEnrollmentHeader(req);
    }
    return true;
  }
}
