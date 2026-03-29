import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisConnectionService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
    this.client = createClient({ socket: { host, port } });
    this.client.on('error', (err) => console.error('[Redis] Client error:', err));
    await this.client.connect();
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  getClient(): RedisClientType {
    if (!this.client?.isOpen) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }
}
