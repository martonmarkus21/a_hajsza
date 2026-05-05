import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CkFlag } from '../entities/ck-flag.entity';
import { CreateCkFlagDto } from './dto/create-ck-flag.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';

@Injectable()
export class CkFlagsService {
  constructor(
    @InjectRepository(CkFlag)
    private ckFlagRepository: Repository<CkFlag>,
    private webSocketGateway: WebSocketGateway,
    private auditLogsService: AuditLogsService,
    private gameRuntimeService: GameRuntimeService,
  ) {}

  async create(createCkFlagDto: CreateCkFlagDto, audit?: AuditRequestMeta) {
    const gameCtx = await this.gameRuntimeService.getRuntimeContext();
    if (!gameCtx.isGameActive) {
      throw new BadRequestException({
        code: 'GAME_NOT_IN_PROGRESS',
        message: 'CK jelölés csak aktív játék időszakban lehetséges.',
      });
    }
    await this.ckFlagRepository.update(
      { pairId: createCkFlagDto.pairId, active: true },
      { active: false },
    );

    const ckFlag = this.ckFlagRepository.create({
      pairId: createCkFlagDto.pairId,
      flaggedByUserId: createCkFlagDto.userId,
      active: true,
    });

    const savedCkFlag = await this.ckFlagRepository.save(ckFlag);

    this.webSocketGateway.broadcastCkHighlight({
      pairId: createCkFlagDto.pairId,
      active: true,
      flaggedBy: {
        id: createCkFlagDto.userId,
        username: 'Officer', // TODO: Get from user service
      },
      timestamp: savedCkFlag.timestamp.toISOString(),
    });

    await this.auditLogsService.log({
      userId: createCkFlagDto.userId,
      actionType: 'ck_flag',
      entityType: 'pair',
      entityId: createCkFlagDto.pairId,
      dataJson: { ckFlagId: savedCkFlag.id },
      ...audit,
    });

    return {
      success: true,
      message: 'CK flag set',
      ckFlag: {
        id: savedCkFlag.id,
        pairId: savedCkFlag.pairId,
        flaggedBy: savedCkFlag.flaggedByUserId,
        timestamp: savedCkFlag.timestamp.toISOString(),
      },
    };
  }

  async remove(pairId: number) {
    await this.ckFlagRepository.update({ pairId, active: true }, { active: false });

    this.webSocketGateway.broadcastCkHighlight({
      pairId,
      active: false,
      flaggedBy: null,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'CK flag removed',
    };
  }
}
