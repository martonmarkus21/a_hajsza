import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MobileEnrollmentService } from './mobile-enrollment.service';

/** Nyilvános ellenőrzés: az app első beállításakor meghívható (titok a fejlécben, HTTPS). */
@Controller('api/mobile')
export class MobileController {
  constructor(private readonly mobileEnrollment: MobileEnrollmentService) {}

  @Get('verify')
  verify(@Req() req: Request) {
    return this.mobileEnrollment.verifyForPublicPing(req);
  }
}
