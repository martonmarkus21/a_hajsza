import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CapturesService } from '../../src/captures/captures.service';
import { Capture } from '../../src/entities/capture.entity';
import { Pair } from '../../src/entities/pair.entity';
import { Device } from '../../src/entities/device.entity';
import { Position } from '../../src/entities/position.entity';
import { User } from '../../src/entities/user.entity';
import { WebSocketGateway } from '../../src/websocket/websocket.gateway';
import { FcmService } from '../../src/fcm/fcm.service';
import { AuditLogsService } from '../../src/audit-logs/audit-logs.service';
import { RedisPositionService } from '../../src/redis/redis-position.service';

function repoMock() {
  return {
    findOne: jest.fn(),
    exist: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
    delete: jest.fn(),
  };
}

describe('CapturesService', () => {
  let service: CapturesService;
  const captureRepo = repoMock();
  const pairRepo = repoMock();
  const deviceRepo = repoMock();
  const positionRepo = repoMock();
  const userRepo = repoMock();
  const ws = { broadcastCapture: jest.fn(), server: { emit: jest.fn() } };
  const fcm = { sendToPair: jest.fn(), sendToAllPairsExceptPair: jest.fn() };
  const audit = { log: jest.fn() };
  const redisPos = { getLivePosition: jest.fn().mockResolvedValue(null) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CapturesService,
        { provide: getRepositoryToken(Capture), useValue: captureRepo },
        { provide: getRepositoryToken(Pair), useValue: pairRepo },
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
        { provide: getRepositoryToken(Position), useValue: positionRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: WebSocketGateway, useValue: ws },
        { provide: FcmService, useValue: fcm },
        { provide: AuditLogsService, useValue: audit },
        { provide: RedisPositionService, useValue: redisPos },
      ],
    }).compile();
    service = moduleRef.get(CapturesService);
  });

  it('rejects when pair not found', async () => {
    pairRepo.findOne.mockResolvedValue(null);
    await expect(service.create({ pairId: 999 }, 10)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns idempotent success when requestId was already processed', async () => {
    captureRepo.findOne.mockResolvedValueOnce({
      id: 12,
      pairId: 2,
      capturedByUserId: 5,
      timestamp: new Date(),
    });
    const result = await service.create({ pairId: 2, requestId: 'abc-123' }, 10);
    expect(result.success).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(fcm.sendToPair).not.toHaveBeenCalled();
  });

  it('rejects already captured pairs', async () => {
    pairRepo.findOne.mockResolvedValue({ id: 2, active: true });
    deviceRepo.exist.mockResolvedValue(true);
    captureRepo.findOne.mockResolvedValue({ id: 11, pairId: 2 });
    await expect(service.create({ pairId: 2 }, 10)).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates capture, broadcasts and logs on happy path', async () => {
    const now = new Date();
    captureRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    pairRepo.findOne.mockResolvedValue({ id: 2, active: true, assignedNumber: 3, name: 'Alma' });
    deviceRepo.exist.mockResolvedValue(true);
    positionRepo.findOne.mockResolvedValue({ id: 77, lat: 47.5, lon: 19.04 });
    userRepo.findOne.mockResolvedValue({ id: 10, username: 'officer1', role: 'officer' });
    captureRepo.save.mockResolvedValue({
      id: 99,
      pairId: 2,
      capturedByUserId: 10,
      timestamp: now,
    });
    const result = await service.create({ pairId: 2, requestId: 'req-1' }, 10);
    expect(result.success).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(ws.broadcastCapture).toHaveBeenCalledTimes(1);
    expect(fcm.sendToPair).toHaveBeenCalledTimes(1);
    expect(fcm.sendToAllPairsExceptPair).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'capture', entityId: 2 }));
  });
});
