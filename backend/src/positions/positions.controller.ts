import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { DeviceAuthGuard } from '../auth/device-auth.guard';

@Controller('api/position')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Post()
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  async create(@Body() createPositionDto: CreatePositionDto, @Request() req: any) {
    return await this.positionsService.create(createPositionDto, req.device);
  }
}

