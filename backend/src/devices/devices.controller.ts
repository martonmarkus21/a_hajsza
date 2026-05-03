import { Controller, Post, Body, Get, UseGuards, Request, Param, Delete, Req } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { DevicesService } from './devices.service';
import { DeviceLoginDto } from './dto/device-login.dto';
import { UpdateDeviceFcmTokenDto } from './dto/update-device-fcm-token.dto';
import { DeviceAuthGuard } from '../auth/device-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';
import { MobileEnrollmentGuard } from '../mobile/mobile-enrollment.guard';
import { MobileEnrollmentService } from '../mobile/mobile-enrollment.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Controller('api/devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly mobileEnrollment: MobileEnrollmentService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /** Admin: Android kapcsolódási URL + titok (QR / másolás). */
  @Get('admin/mobile-connection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAdminMobileConnection(@Req() req: ExpressRequest) {
    return await this.mobileEnrollment.getAdminMobileConnectionDto(req);
  }

  /** Admin: új véletlen titok az adatbázisban (a régi QR / beírt titok érvényét veszti). */
  @Post('admin/mobile-connection/regenerate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async regenerateAdminMobileConnection(@Req() req: ExpressRequest & { user: { userId: number } }) {
    const out = await this.mobileEnrollment.regenerateEnrollmentSecret(req);
    await this.auditLogsService.log({
      userId: req.user.userId,
      actionType: 'mobile_enrollment_secret_regenerated',
      entityType: 'game_settings',
      dataJson: {
        summary:
          'Új mobil kapcsolódási titok került az adatbázisba (QR / telefon párosítás). A korábbi titok és QR érvénytelen.',
        note: 'Biztonság: a titok értéke nem kerül naplózásra; az aktuális érték az „Eszközök → Android kapcsolat” részen nézhető.',
        secretStoredIn: 'database',
        publicApiBaseUrl: out.apiBaseUrl,
      },
      ...auditMetaFromRequest(req),
    });
    return out;
  }

  @Post('login')
  @UseGuards(MobileEnrollmentGuard)
  async login(@Body() deviceLoginDto: DeviceLoginDto) {
    return await this.devicesService.login(deviceLoginDto);
  }

  @Get('me')
  @UseGuards(MobileEnrollmentGuard, DeviceAuthGuard)
  async getMe(@Request() req: any) {
    return await this.devicesService.getDeviceInfo(req.device.deviceId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findAll() {
    return await this.devicesService.findAll();
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async findActive() {
    return await this.devicesService.findActiveDevices();
  }

  @Post('logout')
  @UseGuards(MobileEnrollmentGuard, DeviceAuthGuard)
  async logout(@Request() req: any) {
    return await this.devicesService.logout(req.device.deviceId, false, undefined, auditMetaFromRequest(req));
  }

  @Post('fcm-token')
  @UseGuards(MobileEnrollmentGuard, DeviceAuthGuard)
  async updateFcmToken(@Request() req: any, @Body() dto: UpdateDeviceFcmTokenDto) {
    return await this.devicesService.updateFcmToken(req.device.deviceId, dto.fcmToken);
  }

  @Post('help-request')
  @UseGuards(MobileEnrollmentGuard, DeviceAuthGuard)
  async helpRequest(@Request() req: any) {
    return await this.devicesService.sendHelpRequestFromDevice(req.device);
  }

  @Post('vehicle-session-expired')
  @UseGuards(MobileEnrollmentGuard, DeviceAuthGuard)
  async vehicleSessionExpired(@Request() req: any) {
    return await this.devicesService.recordVehicleSessionExpiredFromDevice(req.device);
  }

  @Post('force-logout/:deviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async forceLogout(@Request() req: any, @Param('deviceId') deviceId: string) {
    return await this.devicesService.logout(deviceId, true, req.user?.userId, auditMetaFromRequest(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return await this.devicesService.delete(parseInt(id, 10));
  }
}





