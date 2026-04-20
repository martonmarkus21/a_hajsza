import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { CapturesController } from '../../src/captures/captures.controller';
import { CapturesService } from '../../src/captures/captures.service';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/roles.guard';

describe('CapturesController (e2e-lite)', () => {
  let app: INestApplication;
  const capturesService = {
    create: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CapturesController],
      providers: [{ provide: CapturesService, useValue: capturesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { userId: 42, role: 'officer' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts manual capture request and injects userId from JWT', async () => {
    capturesService.create.mockResolvedValue({
      success: true,
      idempotent: false,
      capture: { id: 1, pairId: 3, capturedBy: 42, timestamp: new Date().toISOString() },
    });

    await request(app.getHttpServer())
      .post('/api/capture')
      .send({ pairId: 3, requestId: 'req-capture-1' })
      .expect(201);

    expect(capturesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ pairId: 3, requestId: 'req-capture-1' }),
      42,
      expect.any(Object),
    );
  });
});

