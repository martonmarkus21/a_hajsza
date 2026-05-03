import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { MobileEnrollmentService } from './mobile-enrollment.service';

/** Kötelező titkos fejléc, ha a szerveren be van állítva a MOBILE_ENROLLMENT_SECRET. */
@Injectable()
export class MobileEnrollmentGuard implements CanActivate {
  constructor(private readonly mobileEnrollment: MobileEnrollmentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    await this.mobileEnrollment.assertValidEnrollmentHeader(req);
    return true;
  }
}
