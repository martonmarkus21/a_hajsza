import { Controller, Post, Body, Get, UseGuards, Request, Param, Delete } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceLoginDto } from './dto/device-login.dto';
import { DeviceAuthGuard } from '../auth/device-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) { }

  @Post('login')
  async login(@Body() deviceLoginDto: DeviceLoginDto) {
    return await this.devicesService.login(deviceLoginDto);
  }

  @Get('me')
  @UseGuards(DeviceAuthGuard)
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
  @UseGuards(DeviceAuthGuard)
  async logout(@Request() req: any) {
    return await this.devicesService.logout(req.device.deviceId);
  }

  @Post('force-logout/:deviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async forceLogout(@Request() req: any, @Param('deviceId') deviceId: string) {
    return await this.devicesService.logout(deviceId, true, req.user?.userId);
  }

  @Get(':id/delete') // Using GET/DELETE logic or standard DELETE
  // NestJS uses @Delete
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return await this.devicesService.delete(parseInt(id));
  }
}





