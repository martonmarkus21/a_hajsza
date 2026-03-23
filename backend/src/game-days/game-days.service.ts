import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameDay } from '../entities/game-day.entity';
import { CreateGameDayDto } from './dto/create-game-day.dto';

@Injectable()
export class GameDaysService {
  constructor(
    @InjectRepository(GameDay)
    private gameDayRepository: Repository<GameDay>,
  ) {}

  async findAll() {
    return await this.gameDayRepository.find({
      order: { date: 'DESC' },
    });
  }

  async findToday(): Promise<GameDay | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    return await this.gameDayRepository
      .createQueryBuilder('gameDay')
      .where('DATE(gameDay.date) = :date', { date: todayStr })
      .getOne();
  }

  async create(createGameDayDto: CreateGameDayDto) {
    const gameDay = this.gameDayRepository.create({
      date: new Date(createGameDayDto.date),
      startTime: createGameDayDto.startTime,
      endTime: createGameDayDto.endTime,
      specialRulesJson: createGameDayDto.specialRules,
    });

    return await this.gameDayRepository.save(gameDay);
  }

  async isWithinTimeWindow(): Promise<boolean> {
    const gameDay = await this.findToday();
    if (!gameDay) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= gameDay.startTime && currentTime <= gameDay.endTime;
  }

  async isFinalDay(): Promise<boolean> {
    const gameDay = await this.findToday();
    return gameDay?.specialRulesJson?.isFinalDay === true;
  }

}

