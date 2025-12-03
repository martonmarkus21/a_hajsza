import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../entities/position.entity';
import { RuleViolation } from '../entities/rule-violation.entity';
import { RuleViolationsService } from '../rule-violations/rule-violations.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    private ruleViolationsService: RuleViolationsService,
  ) {}

  onModuleInit() {
    console.log('Scheduler service initialized');
  }

  // Check for missing position updates (should be every 20 minutes)
  @Cron('*/20 * * * *')
  async checkPositionUpdates() {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    
    // Get all active pairs
    const positions = await this.positionRepository
      .createQueryBuilder('position')
      .select('position.pairId')
      .addSelect('MAX(position.timestamp)', 'lastUpdate')
      .groupBy('position.pairId')
      .getRawMany();

    for (const pos of positions) {
      const lastUpdate = new Date(pos.lastUpdate);
      if (lastUpdate < twentyMinutesAgo) {
        console.log(`Pair ${pos.pairId} has not sent position update in the last 20 minutes`);
        // TODO: Send alert or notification
      }
    }
  }

  // Check for unresolved rule violations
  @Cron('*/5 * * * *')
  async checkRuleViolations() {
    const violations = await this.ruleViolationRepository.find({
      where: { resolved: false },
      relations: ['pair', 'position'],
    });

    for (const violation of violations) {
      // Check if violation should be resolved
      if (violation.violationType === 'game_area_exit') {
        // Check if pair is back in game area
        const lastPosition = await this.positionRepository.findOne({
          where: { pairId: violation.pairId },
          order: { timestamp: 'DESC' },
        });

        if (lastPosition) {
          // Re-check violation
          await this.ruleViolationsService.checkViolations(violation.pairId, lastPosition);
        }
      }
    }
  }
}






