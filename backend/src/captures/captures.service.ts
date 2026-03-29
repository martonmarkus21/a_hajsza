import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Capture } from '../entities/capture.entity';
import { Position } from '../entities/position.entity';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { FcmService } from '../fcm/fcm.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { GameDaysService } from '../game-days/game-days.service';

@Injectable()
export class CapturesService {
  constructor(
    @InjectRepository(Capture)
    private captureRepository: Repository<Capture>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private webSocketGateway: WebSocketGateway,
    private fcmService: FcmService,
    private auditLogsService: AuditLogsService,
    private gameDaysService: GameDaysService,
  ) {}

  async create(createCaptureDto: CreateCaptureDto) {
    // Check if within time window (8:00-16:00, or 10:00-14:00 on final day)
    const isWithinTime = await this.gameDaysService.isWithinTimeWindow();
    if (!isWithinTime) {
      throw new BadRequestException('Capture only allowed within game time window');
    }

    // Check if already captured
    const existingCapture = await this.captureRepository.findOne({
      where: { pairId: createCaptureDto.pairId },
    });

    if (existingCapture) {
      throw new BadRequestException('Pair already captured');
    }

    // Last persisted position sample (counter cycle); may be null if only Redis has recent fixes
    const lastPosition = await this.positionRepository.findOne({
      where: { pairId: createCaptureDto.pairId },
      order: { timestamp: 'DESC' },
    });

    const capture = this.captureRepository.create({
      pairId: createCaptureDto.pairId,
      capturedByUserId: createCaptureDto.userId,
      locationId: lastPosition?.id,
    });

    const savedCapture = await this.captureRepository.save(capture);

    // Broadcast via WebSocket
    this.webSocketGateway.broadcastCapture({
      pairId: createCaptureDto.pairId,
      capturedBy: {
        id: createCaptureDto.userId,
        username: 'Officer', // TODO: Get from user service
      },
      timestamp: savedCapture.timestamp.toISOString(),
    });

    // Send FCM push notification
    await this.fcmService.sendToPair(createCaptureDto.pairId, {
      title: 'Elfogtak!',
      body: `Elfogták a ${createCaptureDto.pairId}. párt`,
    });

    // Audit log
    await this.auditLogsService.log({
      userId: createCaptureDto.userId,
      actionType: 'capture',
      entityType: 'pair',
      entityId: createCaptureDto.pairId,
      dataJson: { captureId: savedCapture.id },
    });

    return {
      success: true,
      message: 'Pair captured',
      capture: {
        id: savedCapture.id,
        pairId: savedCapture.pairId,
        capturedBy: savedCapture.capturedByUserId,
        timestamp: savedCapture.timestamp.toISOString(),
      },
    };
  }
}
