import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { GameDaysService } from './game-days.service';
import { CreateGameDayDto } from './dto/create-game-day.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('api/game-days')
@UseGuards(JwtAuthGuard)
export class GameDaysController {
  constructor(private readonly gameDaysService: GameDaysService) {}

  @Get()
  async findAll() {
    return await this.gameDaysService.findAll();
  }

  @Get('today')
  async findToday() {
    return await this.gameDaysService.findToday();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@Body() createGameDayDto: CreateGameDayDto) {
    return await this.gameDaysService.create(createGameDayDto);
  }
}
