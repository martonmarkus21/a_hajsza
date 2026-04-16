import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { GeofencesService } from './geofences.service';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/geofence')
@UseGuards(JwtAuthGuard)
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) { }

  @Get()
  async findAll() {
    return await this.geofencesService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@Body() createGeofenceDto: CreateGeofenceDto, @Request() req: any) {
    return await this.geofencesService.create(createGeofenceDto, req.user.userId, auditMetaFromRequest(req));
  }

  @Put(':id/activate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async activate(@Param('id') id: string) {
    return await this.geofencesService.activate(parseInt(id));
  }

  @Put(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async deactivate(@Param('id') id: string) {
    return await this.geofencesService.deactivate(parseInt(id));
  }

  @Put('bulk-status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async bulkUpdateStatus(@Body() body: { activateIds: number[], deactivateIds: number[] }) {
    return await this.geofencesService.bulkUpdateStatus(body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string, @Request() req: any) {
    return await this.geofencesService.delete(parseInt(id), req.user.userId, auditMetaFromRequest(req));
  }
}



