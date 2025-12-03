import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MwFlag } from '../entities/mw-flag.entity';
import { Position } from '../entities/position.entity';
import { CreateMwFlagDto } from './dto/create-mw-flag.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class MwFlagsService {
  constructor(
    @InjectRepository(MwFlag)
    private mwFlagRepository: Repository<MwFlag>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private webSocketGateway: WebSocketGateway,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createMwFlagDto: CreateMwFlagDto) {
    // Deactivate existing MW flags for this pair
    await this.mwFlagRepository.update(
      { pairId: createMwFlagDto.pairId, active: true },
      { active: false },
    );

    const mwFlag = this.mwFlagRepository.create({
      pairId: createMwFlagDto.pairId,
      flaggedByUserId: createMwFlagDto.userId,
      active: true,
    });

    const savedMwFlag = await this.mwFlagRepository.save(mwFlag);

    // Broadcast via WebSocket
    this.webSocketGateway.broadcastMwHighlight({
      pairId: createMwFlagDto.pairId,
      active: true,
      flaggedBy: {
        id: createMwFlagDto.userId,
        username: 'Officer', // TODO: Get from user service
      },
      timestamp: savedMwFlag.timestamp.toISOString(),
    });

    // Audit log
    await this.auditLogsService.log({
      userId: createMwFlagDto.userId,
      actionType: 'mw_flag',
      entityType: 'pair',
      entityId: createMwFlagDto.pairId,
      dataJson: { mwFlagId: savedMwFlag.id },
    });

    // Check for automatic MW (500m distance)
    await this.checkAutomaticMW(createMwFlagDto.pairId);

    return {
      success: true,
      message: 'MW flag set',
      mwFlag: {
        id: savedMwFlag.id,
        pairId: savedMwFlag.pairId,
        flaggedBy: savedMwFlag.flaggedByUserId,
        timestamp: savedMwFlag.timestamp.toISOString(),
      },
    };
  }

  async remove(pairId: number) {
    await this.mwFlagRepository.update(
      { pairId, active: true },
      { active: false },
    );

    // Broadcast deactivation
    this.webSocketGateway.broadcastMwHighlight({
      pairId,
      active: false,
      flaggedBy: null,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'MW flag removed',
    };
  }

  private async checkAutomaticMW(pairId: number) {
    // Get pair's last position
    const pairPosition = await this.positionRepository.findOne({
      where: { pairId },
      order: { timestamp: 'DESC' },
    });

    if (!pairPosition) return;

    // Get all officer positions (simplified: we'd need officer tracking)
    // For now, check if any pair is within 500m of this pair
    const allPositions = await this.positionRepository
      .createQueryBuilder('position')
      .select('position.pairId')
      .addSelect('MAX(position.timestamp)', 'maxTime')
      .groupBy('position.pairId')
      .getRawMany();

    for (const pos of allPositions) {
      if (pos.pairId === pairId) continue;

      const otherPairPosition = await this.positionRepository.findOne({
        where: { pairId: pos.pairId },
        order: { timestamp: 'DESC' },
      });

      if (otherPairPosition) {
        const distance = this.calculateDistance(
          parseFloat(pairPosition.lat.toString()),
          parseFloat(pairPosition.lon.toString()),
          parseFloat(otherPairPosition.lat.toString()),
          parseFloat(otherPairPosition.lon.toString()),
        );

        if (distance <= 500) {
          // Auto MW for nearby pair
          const existingMw = await this.mwFlagRepository.findOne({
            where: { pairId: pos.pairId, active: true },
          });

          if (!existingMw) {
            const autoMw = this.mwFlagRepository.create({
              pairId: pos.pairId,
              flaggedByUserId: 0, // System
              active: true,
            });
            await this.mwFlagRepository.save(autoMw);

            this.webSocketGateway.broadcastMwHighlight({
              pairId: pos.pairId,
              active: true,
              flaggedBy: { id: 0, username: 'System (Auto)' },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
