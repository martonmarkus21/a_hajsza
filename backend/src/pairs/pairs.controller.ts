import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PairsService } from './pairs.service';
import { UpdatePairNameDto } from './dto/update-pair-name.dto';
import { CreatePairDto } from './dto/create-pair.dto';
import { UpdatePairDto } from './dto/update-pair.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { auditMetaFromRequest } from '../common/audit-request.util';

@Controller('api/pairs')
@UseGuards(JwtAuthGuard)
export class PairsController {
  constructor(private readonly pairsService: PairsService) {}

  @Get()
  async findAll(@Query('active') active?: string) {
    const activeFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    return await this.pairsService.findAll(activeFilter);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@Body() createPairDto: CreatePairDto, @Request() req: any) {
    return await this.pairsService.create(createPairDto, req.user.userId, auditMetaFromRequest(req));
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() updatePairDto: UpdatePairDto, @Request() req: any) {
    return await this.pairsService.update(parseInt(id), updatePairDto, req.user.userId, auditMetaFromRequest(req));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string, @Request() req: any) {
    return await this.pairsService.delete(parseInt(id), req.user.userId, auditMetaFromRequest(req));
  }

  @Put(':id/name')
  async updateName(
    @Param('id') id: string,
    @Body() updatePairNameDto: UpdatePairNameDto,
    @Request() req: any,
  ) {
    return await this.pairsService.updateName(
      parseInt(id),
      updatePairNameDto.name,
      req.user.userId,
      auditMetaFromRequest(req),
    );
  }
}

