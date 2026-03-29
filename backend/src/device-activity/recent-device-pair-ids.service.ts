import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';

/**
 * Short-lived in-memory cache for: pair IDs with at least one device seen in the last 30 minutes.
 * Used for game timer sync (e.g. whether all such pairs have reported position this cycle).
 */
@Injectable()
export class RecentDevicePairIdsService {
  private snapshot: { expiresAt: number; pairIds: number[] } | null = null;
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {
    this.ttlMs = parseInt(process.env.RECENT_DEVICE_PAIR_IDS_CACHE_MS || '400', 10);
  }

  invalidateSnapshot(): void {
    this.snapshot = null;
  }

  async getDistinctRecentDevicePairIds(): Promise<number[]> {
    const now = Date.now();
    if (this.ttlMs > 0 && this.snapshot && now < this.snapshot.expiresAt) {
      return [...this.snapshot.pairIds];
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const activeRows = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.pairId IS NOT NULL')
      .andWhere('device.lastSeenAt IS NOT NULL')
      .andWhere('device.loggedOutAt IS NULL')
      .andWhere('device.lastSeenAt > :thirtyMinutesAgo', { thirtyMinutesAgo })
      .select('DISTINCT device.pairId', 'pairId')
      .getRawMany();

    const pairIds = activeRows
      .map((r: { pairId: number }) => r.pairId)
      .filter((id: number) => id != null);

    this.snapshot = {
      expiresAt: now + Math.max(this.ttlMs, 1),
      pairIds,
    };
    return [...pairIds];
  }
}
