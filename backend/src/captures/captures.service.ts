import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, QueryFailedError, Repository } from 'typeorm';
import { Capture } from '../entities/capture.entity';
import { Pair } from '../entities/pair.entity';
import { Device } from '../entities/device.entity';
import { Position } from '../entities/position.entity';
import { User } from '../entities/user.entity';
import { CreateCaptureDto } from './dto/create-capture.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { FcmService } from '../fcm/fcm.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { logVerbose } from '../common/verbose-log';
import { RedisPositionService } from '../redis/redis-position.service';
import { GameRuntimeService } from '../game-runtime/game-runtime.service';

@Injectable()
export class CapturesService {
  private static readonly CAPTURE_COOLDOWN_MS = 15_000;
  private static readonly CLIENT_TIMESTAMP_TOLERANCE_MS = 2 * 60_000;
  private static readonly ACTIVE_DEVICE_MAX_AGE_MS = 30 * 60_000;

  constructor(
    @InjectRepository(Capture)
    private captureRepository: Repository<Capture>,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private redisPositionService: RedisPositionService,
    private webSocketGateway: WebSocketGateway,
    private fcmService: FcmService,
    private auditLogsService: AuditLogsService,
    private gameRuntimeService: GameRuntimeService,
  ) {}

  private buildSuccessResponse(capture: Capture, idempotent = false) {
    return {
      success: true,
      message: idempotent ? 'Az elfogás már rögzítve van' : 'Pár elfogva',
      idempotent,
      capture: {
        id: capture.id,
        pairId: capture.pairId,
        capturedBy: capture.capturedByUserId,
        timestamp: capture.timestamp.toISOString(),
      },
    };
  }

  private buildClientTsError(parsedClientTs?: Date) {
    return new BadRequestException({
      code: 'CLIENT_TIMESTAMP_INVALID',
      message: 'A kliens időbélyeg hiányzik vagy nincs a megengedett tartományban',
      serverTimestamp: new Date().toISOString(),
      ...(parsedClientTs ? { clientTimestamp: parsedClientTs.toISOString() } : {}),
    });
  }

  private async rejectCapture(
    userId: number,
    pairId: number,
    code: string,
    message: string,
    audit?: AuditRequestMeta,
    extra: Record<string, unknown> = {},
  ): Promise<never> {
    await this.auditLogsService.log({
      userId,
      actionType: 'capture_rejected',
      entityType: 'pair',
      entityId: pairId,
      dataJson: {
        code,
        message,
        ...extra,
      },
      ...audit,
    });

    if (code === 'ALREADY_CAPTURED') {
      throw new ConflictException({ code, message, ...extra });
    }
    throw new BadRequestException({ code, message, ...extra });
  }

  async create(createCaptureDto: CreateCaptureDto, userId: number, audit?: AuditRequestMeta) {
    const parsedClientTs = createCaptureDto.clientTimestamp
      ? new Date(createCaptureDto.clientTimestamp)
      : undefined;
    if (createCaptureDto.clientTimestamp && Number.isNaN(parsedClientTs?.getTime())) {
      await this.auditLogsService.log({
        userId,
        actionType: 'capture_rejected',
        entityType: 'pair',
        entityId: createCaptureDto.pairId,
        dataJson: {
          code: 'CLIENT_TIMESTAMP_INVALID',
          message: 'Érvénytelen kliens időbélyeg',
          rawClientTimestamp: createCaptureDto.clientTimestamp,
        },
        ...audit,
      });
      throw this.buildClientTsError();
    }
    if (
      parsedClientTs &&
      Math.abs(Date.now() - parsedClientTs.getTime()) > CapturesService.CLIENT_TIMESTAMP_TOLERANCE_MS
    ) {
      await this.auditLogsService.log({
        userId,
        actionType: 'capture_rejected',
        entityType: 'pair',
        entityId: createCaptureDto.pairId,
        dataJson: {
          code: 'CLIENT_TIMESTAMP_INVALID',
          message: 'A kliens időbélyeg nincs a megengedett tartományban',
          clientTimestamp: parsedClientTs.toISOString(),
        },
        ...audit,
      });
      throw this.buildClientTsError(parsedClientTs);
    }

    if (createCaptureDto.requestId) {
      const existingByRequest = await this.captureRepository.findOne({
        where: { requestId: createCaptureDto.requestId },
      });
      if (existingByRequest) {
        return this.buildSuccessResponse(existingByRequest, true);
      }
    }

    const pair = await this.pairRepository.findOne({ where: { id: createCaptureDto.pairId } });
    if (!pair) {
      return await this.rejectCapture(
        userId,
        createCaptureDto.pairId,
        'PAIR_NOT_FOUND',
        'A célpár nem található',
        audit,
      );
    }

    const gameCtx = await this.gameRuntimeService.getRuntimeContext();
    if (!gameCtx.isGameActive) {
      return await this.rejectCapture(
        userId,
        createCaptureDto.pairId,
        'GAME_NOT_IN_PROGRESS',
        'Elfogás csak a játék időtartama alatt lehetséges (a játékmotor ebben az időben aktív).',
        audit,
      );
    }

    const thirtyMinutesAgo = new Date(Date.now() - CapturesService.ACTIVE_DEVICE_MAX_AGE_MS);
    const hasActiveDevice = await this.deviceRepository.exist({
      where: {
        pairId: createCaptureDto.pairId,
        loggedOutAt: IsNull(),
        lastSeenAt: MoreThan(thirtyMinutesAgo),
      },
    });
    if (!pair.active || !hasActiveDevice) {
      return await this.rejectCapture(
        userId,
        createCaptureDto.pairId,
        'PAIR_INACTIVE',
        'Elfogás csak aktív páron engedélyezett',
        audit,
        {
          pairActive: pair.active,
          hasActiveDevice,
        },
      );
    }

    const existingCapture = await this.captureRepository.findOne({
      where: { pairId: createCaptureDto.pairId },
    });
    if (existingCapture) {
      return await this.rejectCapture(
        userId,
        createCaptureDto.pairId,
        'ALREADY_CAPTURED',
        'A pár már el van fogva',
        audit,
        { captureId: existingCapture.id },
      );
    }

    const lastSameOfficerCapture = await this.captureRepository.findOne({
      where: { pairId: createCaptureDto.pairId, capturedByUserId: userId },
      order: { timestamp: 'DESC' },
    });
    if (
      lastSameOfficerCapture &&
      Date.now() - new Date(lastSameOfficerCapture.timestamp).getTime() < CapturesService.CAPTURE_COOLDOWN_MS
    ) {
      const remainingMs =
        CapturesService.CAPTURE_COOLDOWN_MS -
        (Date.now() - new Date(lastSameOfficerCapture.timestamp).getTime());
      return await this.rejectCapture(
        userId,
        createCaptureDto.pairId,
        'COOLDOWN_ACTIVE',
        'Az elfogás várakozási idő még aktív',
        audit,
        { retryAfterMs: Math.max(0, remainingMs) },
      );
    }

    const lastPosition = await this.positionRepository.findOne({
      where: { pairId: createCaptureDto.pairId },
      order: { timestamp: 'DESC' },
    });

    const hasPairCoords =
      createCaptureDto.pairLat != null &&
      createCaptureDto.pairLon != null &&
      Number.isFinite(createCaptureDto.pairLat) &&
      Number.isFinite(createCaptureDto.pairLon);
    if (
      (createCaptureDto.pairLat != null && createCaptureDto.pairLon == null) ||
      (createCaptureDto.pairLat == null && createCaptureDto.pairLon != null)
    ) {
      return await this.rejectCapture(
        userId,
        createCaptureDto.pairId,
        'CAPTURE_COORDS_INCOMPLETE',
        'A párhoz tartozó szélességi és hosszúsági koordinátát együtt kell megadni, vagy egyiket sem',
        audit,
      );
    }

    let capturedLat: number | null = null;
    let capturedLon: number | null = null;
    let locationId: number | null = null;

    if (hasPairCoords) {
      capturedLat = createCaptureDto.pairLat as number;
      capturedLon = createCaptureDto.pairLon as number;
    } else {
      const live = await this.redisPositionService.getLivePosition(createCaptureDto.pairId);
      if (live && Number.isFinite(live.lat) && Number.isFinite(live.lon)) {
        capturedLat = live.lat;
        capturedLon = live.lon;
      } else if (lastPosition) {
        capturedLat = parseFloat(String(lastPosition.lat));
        capturedLon = parseFloat(String(lastPosition.lon));
        locationId = lastPosition.id;
      }
    }

    const recordedAt = new Date();

    const capture = this.captureRepository.create({
      pairId: createCaptureDto.pairId,
      capturedByUserId: userId,
      locationId,
      requestId: createCaptureDto.requestId ?? null,
      clientTimestamp: parsedClientTs ?? null,
      timestamp: recordedAt,
      capturedLat,
      capturedLon,
    });

    let savedCapture: Capture;
    try {
      savedCapture = await this.captureRepository.save(capture);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).driverError?.code === '23505') {
        if (createCaptureDto.requestId) {
          const byRequestId = await this.captureRepository.findOne({
            where: { requestId: createCaptureDto.requestId },
          });
          if (byRequestId) {
            return this.buildSuccessResponse(byRequestId, true);
          }
        }
        const byPair = await this.captureRepository.findOne({
          where: { pairId: createCaptureDto.pairId },
        });
        if (byPair) {
          return await this.rejectCapture(
            userId,
            createCaptureDto.pairId,
            'ALREADY_CAPTURED',
            'A pár már el van fogva',
            audit,
            { captureId: byPair.id, source: 'db_unique' },
          );
        }
      }
      throw error;
    }

    const capturingUser = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'username'],
    });

    const captureLocation =
      savedCapture.capturedLat != null && savedCapture.capturedLon != null
        ? {
            lat: Number(savedCapture.capturedLat),
            lon: Number(savedCapture.capturedLon),
          }
        : null;

    this.webSocketGateway.broadcastCapture({
      pairId: createCaptureDto.pairId,
      assignedNumber: pair.assignedNumber,
      pairName: pair.name ?? null,
      capturedBy: {
        id: userId,
        username: capturingUser?.username ?? 'Ismeretlen',
      },
      timestamp: savedCapture.timestamp.toISOString(),
      captureLocation,
    });

    const pairLabel = `${pair.assignedNumber}. pár${pair.name ? ` (${pair.name})` : ''}`;
    logVerbose(
      `[Capture] Capture recorded: ${pairLabel} | userId=${userId} | captureId=${savedCapture.id}`,
    );

    await this.fcmService.sendToPair(createCaptureDto.pairId, {
      title: 'Elfogás',
      body: 'Elfogtak titeket. Kövesd a szervezők utasításait.',
      data: {
        type: 'capture_confirmed',
        pairId: String(createCaptureDto.pairId),
        pairAssignedNumber: String(pair.assignedNumber),
        pairName: pair.name ?? '',
        captureId: String(savedCapture.id),
        capturedAt: savedCapture.timestamp.toISOString(),
      },
    });

    await this.fcmService.sendToAllPairsExceptPair(createCaptureDto.pairId, {
      title: 'Elfogás',
      body: 'Egy másik párt elfogtak. Nálatok nem változik semmi, játsszatok tovább a szabályok szerint.',
    });

    await this.auditLogsService.log({
      userId,
      actionType: 'capture',
      entityType: 'pair',
      entityId: createCaptureDto.pairId,
      dataJson: {
        code: 'CAPTURE_ACCEPTED',
        captureId: savedCapture.id,
        requestId: createCaptureDto.requestId ?? null,
        clientTimestamp: parsedClientTs ? parsedClientTs.toISOString() : null,
        locationId,
        capturedLat,
        capturedLon,
        pairWasActive: pair.active,
      },
      ...audit,
    });

    return this.buildSuccessResponse(savedCapture);
  }

  async revertByPairId(pairId: number, userId: number, audit?: AuditRequestMeta) {
    const pair = await this.pairRepository.findOne({ where: { id: pairId } });
    if (!pair) {
      throw new BadRequestException({
        code: 'PAIR_NOT_FOUND',
        message: 'A célpár nem található',
      });
    }

    const capture = await this.captureRepository.findOne({ where: { pairId } });
    if (!capture) {
      throw new BadRequestException({
        code: 'CAPTURE_NOT_FOUND',
        message: 'Ehhez a párhoz nincs rögzített elfogás',
      });
    }

    await this.captureRepository.delete({ id: capture.id });
    const live = await this.redisPositionService.getLivePosition(pairId);

    const pairLabel = `${pair.assignedNumber}. pár${pair.name ? ` (${pair.name})` : ''}`;
    logVerbose(
      `[Capture] Capture reverted: ${pairLabel} | userId=${userId} | captureId=${capture.id}`,
    );

    this.webSocketGateway.server.emit('captureReverted', {
      pairId,
      assignedNumber: pair.assignedNumber,
      pairName: pair.name ?? null,
      revertedByUserId: userId,
      timestamp: new Date().toISOString(),
      lastLivePosition:
        live && Number.isFinite(live.lat) && Number.isFinite(live.lon)
          ? { lat: live.lat, lon: live.lon, timestamp: live.timestamp }
          : null,
    });

    await this.fcmService.sendToPair(pairId, {
      title: 'Elfogás visszavonva',
      body: 'Visszavonták az elfogást. Újra a szokásos szabályok vonatkoznak rátok.',
      data: {
        type: 'capture_reverted',
        pairId: String(pairId),
        pairAssignedNumber: String(pair.assignedNumber),
        pairName: pair.name ?? '',
      },
    });

    await this.fcmService.sendToAllPairsExceptPair(pairId, {
      title: 'Elfogás visszavonva',
      body: 'Egy párnál visszavonták az elfogást. Nálatok nem változik semmi.',
    });

    await this.auditLogsService.log({
      userId,
      actionType: 'capture_revert',
      entityType: 'pair',
      entityId: pairId,
      dataJson: {
        code: 'CAPTURE_REVERTED',
        revertedCaptureId: capture.id,
      },
      ...audit,
    });

    return {
      success: true,
      message: 'Az elfogás visszavonása sikeres',
      pairId,
      revertedCaptureId: capture.id,
    };
  }
}
