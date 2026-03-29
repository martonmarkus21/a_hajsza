import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MwFlag } from '../entities/mw-flag.entity';
import { CreateMwFlagDto } from './dto/create-mw-flag.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class MwFlagsService {
  constructor(
    @InjectRepository(MwFlag)
    private mwFlagRepository: Repository<MwFlag>,
    private webSocketGateway: WebSocketGateway,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(createMwFlagDto: CreateMwFlagDto) {
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

    this.webSocketGateway.broadcastMwHighlight({
      pairId: createMwFlagDto.pairId,
      active: true,
      flaggedBy: {
        id: createMwFlagDto.userId,
        username: 'Officer', // TODO: Get from user service
      },
      timestamp: savedMwFlag.timestamp.toISOString(),
    });

    await this.auditLogsService.log({
      userId: createMwFlagDto.userId,
      actionType: 'mw_flag',
      entityType: 'pair',
      entityId: createMwFlagDto.pairId,
      dataJson: { mwFlagId: savedMwFlag.id },
    });

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
    await this.mwFlagRepository.update({ pairId, active: true }, { active: false });

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
}
