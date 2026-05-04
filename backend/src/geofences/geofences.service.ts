import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from '../entities/geofence.entity';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { loadHungaryBoundaryFromGeoJSON } from '../game-area/load-geojson';
import { RedisGeofenceCacheService } from '../redis/redis-geofence-cache.service';
import { logVerbose } from '../common/verbose-log';

@Injectable()
export class GeofencesService {
  constructor(
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
    private auditLogsService: AuditLogsService,
    private webSocketGateway: WebSocketGateway,
    private redisGeofenceCache: RedisGeofenceCacheService,
  ) {}

  async findAll() {
    const geofences = await this.geofenceRepository.find({
      order: { createdAt: 'DESC' },
    });

    return geofences.map((g) => ({
      id: g.id,
      name: g.name,
      centerLat: parseFloat(g.centerLat.toString()),
      centerLon: parseFloat(g.centerLon.toString()),
      radiusM: g.radiusM,
      active: g.active,
      geofenceType: g.geofenceType,
      metadataJson: g.metadataJson,
    }));
  }

  async create(createGeofenceDto: CreateGeofenceDto, userId: number, audit?: AuditRequestMeta) {
    const geofence = this.geofenceRepository.create({
      name: createGeofenceDto.name,
      centerLat: createGeofenceDto.centerLat,
      centerLon: createGeofenceDto.centerLon,
      radiusM: createGeofenceDto.radiusM,
      activeFrom: createGeofenceDto.activeFrom ? new Date(createGeofenceDto.activeFrom) : null,
      activeUntil: createGeofenceDto.activeUntil ? new Date(createGeofenceDto.activeUntil) : null,
      geofenceType: createGeofenceDto.geofenceType || 'scenario',
      metadataJson: createGeofenceDto.metadataJson,
      active: createGeofenceDto.active ?? false,
    });

    const savedGeofence = await this.geofenceRepository.save(geofence);
    await this.redisGeofenceCache.invalidateActiveGeofences();

    // Broadcast update to all clients (Main Map) active or not, to keep lists in sync
    this.webSocketGateway.broadcastGameAreaUpdate({
      timestamp: new Date().toISOString(),
    });

    // Audit log
    await this.auditLogsService.log({
      userId,
      actionType: 'geofence_create',
      entityType: 'geofence',
      entityId: savedGeofence.id,
      dataJson: { name: savedGeofence.name },
      ...audit,
    });

    return {
      success: true,
      geofence: savedGeofence,
    };
  }

  async activate(id: number, userId?: number, audit?: AuditRequestMeta) {
    const geofence = await this.geofenceRepository.findOne({ where: { id } });
    if (!geofence) {
      throw new Error('Geofence not found');
    }

    // If this is the "Magyarország" game_area geofence, ensure it has polygon data
    if (geofence.name === 'Magyarország' && geofence.geofenceType === 'game_area') {
      const metadata = geofence.metadataJson as any || {};

      // If polygon data is missing, load it from GeoJSON
      if (!metadata.polygon || !metadata.type || metadata.type !== 'polygon') {
        const hungaryPolygon = loadHungaryBoundaryFromGeoJSON();
        if (hungaryPolygon) {
          // Calculate center and radius for the polygon
          const center = this.calculatePolygonCenter(hungaryPolygon);
          const radius = this.calculatePolygonRadius(hungaryPolygon, center);

          geofence.centerLat = center.lat;
          geofence.centerLon = center.lon;
          geofence.radiusM = radius;
          geofence.metadataJson = {
            ...metadata,
            polygon: hungaryPolygon,
            type: 'polygon',
          } as any;

          logVerbose('Updated Hungary geofence with polygon data on activation');
        }
      }
    }

    geofence.active = true;
    await this.geofenceRepository.save(geofence);
    await this.redisGeofenceCache.invalidateActiveGeofences();

    // Broadcast update for ALL geofence types
    this.webSocketGateway.broadcastGameAreaUpdate({
      timestamp: new Date().toISOString(),
    });

    if (userId != null) {
      await this.auditLogsService.log({
        userId,
        actionType: 'geofence_activate',
        entityType: 'geofence',
        entityId: id,
        dataJson: { name: geofence.name },
        ...audit,
      });
    }

    return { success: true, message: 'Geofence activated' };
  }

  private calculatePolygonCenter(polygon: number[][]): { lat: number; lon: number } {
    let sumLat = 0;
    let sumLon = 0;
    for (const [lon, lat] of polygon) {
      sumLat += lat;
      sumLon += lon;
    }
    return {
      lat: sumLat / polygon.length,
      lon: sumLon / polygon.length,
    };
  }

  private calculatePolygonRadius(polygon: number[][], center: { lat: number; lon: number }): number {
    let maxDistance = 0;
    for (const [lon, lat] of polygon) {
      const distance = this.haversineDistance(center.lat, center.lon, lat, lon);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    }
    return Math.ceil(maxDistance);
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  async deactivate(id: number, userId?: number, audit?: AuditRequestMeta) {
    const geofence = await this.geofenceRepository.findOne({ where: { id } });
    if (!geofence) {
      throw new Error('Geofence not found');
    }

    geofence.active = false;
    await this.geofenceRepository.save(geofence);
    await this.redisGeofenceCache.invalidateActiveGeofences();

    // Broadcast update for ALL geofence types
    this.webSocketGateway.broadcastGameAreaUpdate({
      timestamp: new Date().toISOString(),
    });

    if (userId != null) {
      await this.auditLogsService.log({
        userId,
        actionType: 'geofence_deactivate',
        entityType: 'geofence',
        entityId: id,
        dataJson: { name: geofence.name },
        ...audit,
      });
    }

    return { success: true, message: 'Geofence deactivated' };
  }

  async bulkUpdateStatus(
    data: { activateIds: number[]; deactivateIds: number[] },
    userId?: number,
    audit?: AuditRequestMeta,
  ) {
    const activateIds = data.activateIds ?? [];
    const deactivateIds = data.deactivateIds ?? [];

    if (activateIds.length > 0) {
      await this.geofenceRepository
        .createQueryBuilder()
        .update(Geofence)
        .set({ active: true })
        .where("id IN (:...ids)", { ids: activateIds })
        .execute();

      // Special check: If activiating Hungary, ensure polygon data exists
      const hungary = await this.geofenceRepository.findOne({ where: { name: 'Magyarország', geofenceType: 'game_area' } });
      if (hungary && activateIds.includes(hungary.id)) {
        // Reuse the logic from activate() to ensure polygon data is loaded
        // We initiate a separate activate call internally or duplicate logic. 
        // Duplicating logic for safety and speed to avoid broadcast loop.
        const metadata = hungary.metadataJson as any || {};
        if (!metadata.polygon || !metadata.type || metadata.type !== 'polygon') {
          const hungaryPolygon = loadHungaryBoundaryFromGeoJSON();
          if (hungaryPolygon) {
            const center = this.calculatePolygonCenter(hungaryPolygon);
            const radius = this.calculatePolygonRadius(hungaryPolygon, center);
            hungary.centerLat = center.lat;
            hungary.centerLon = center.lon;
            hungary.radiusM = radius;
            hungary.metadataJson = { ...metadata, polygon: hungaryPolygon, type: 'polygon' } as any;
            await this.geofenceRepository.save(hungary);
          }
        }
      }
    }

    if (deactivateIds.length > 0) {
      await this.geofenceRepository
        .createQueryBuilder()
        .update(Geofence)
        .set({ active: false })
        .where("id IN (:...ids)", { ids: deactivateIds })
        .execute();
    }

    await this.redisGeofenceCache.invalidateActiveGeofences();

    // Broadcast SINGLE update after all operations
    this.webSocketGateway.broadcastGameAreaUpdate({
      timestamp: new Date().toISOString(),
    });

    if (userId != null && (activateIds.length > 0 || deactivateIds.length > 0)) {
      await this.auditLogsService.log({
        userId,
        actionType: 'geofence_bulk_status',
        entityType: 'geofence',
        dataJson: { activateIds, deactivateIds },
        ...audit,
      });
    }

    return { success: true, message: 'Geofences updated atomically' };
  }

  async delete(id: number, userId: number, audit?: AuditRequestMeta) {
    const geofence = await this.geofenceRepository.findOne({ where: { id } });
    if (!geofence) {
      throw new Error('Geofence not found');
    }

    await this.geofenceRepository.remove(geofence);
    await this.redisGeofenceCache.invalidateActiveGeofences();

    // Audit log
    await this.auditLogsService.log({
      userId,
      actionType: 'geofence_delete',
      entityType: 'geofence',
      entityId: id,
      dataJson: { name: geofence.name },
      ...audit,
    });

    this.webSocketGateway.broadcastGameAreaUpdate({
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: 'Geofence deleted' };
  }
}


