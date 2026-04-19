import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from '../entities/geofence.entity';
import { UpdateGameAreaDto } from './dto/update-game-area.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditRequestMeta } from '../common/audit-request.util';
import { loadCountiesFromGeoJSON, loadHungaryBoundaryFromGeoJSON } from './load-geojson';
import { RedisGeofenceCacheService } from '../redis/redis-geofence-cache.service';

@Injectable()
export class GameAreaService implements OnModuleInit {
  private counties: Record<string, { name: string; polygon: number[][] }> = {};
  private hungaryBoundary: number[][] | null = null;

  constructor(
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
    private webSocketGateway: WebSocketGateway,
    private auditLogsService: AuditLogsService,
    private redisGeofenceCache: RedisGeofenceCacheService,
  ) {
    // Load counties from GeoJSON on service initialization
    try {
      this.counties = loadCountiesFromGeoJSON();
      this.hungaryBoundary = loadHungaryBoundaryFromGeoJSON();

      if (Object.keys(this.counties).length === 0) {
        console.warn('No counties loaded from GeoJSON, using fallback');
      } else {
        console.log(`Successfully loaded ${Object.keys(this.counties).length} counties from GeoJSON`);
      }
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
      this.counties = {};
      this.hungaryBoundary = null;
    }
  }

  async onModuleInit(): Promise<void> {
    await this.ensureCountyGeofencesSeededFromGeojson();
  }

  /**
   * A counties.geojson összes polygon megyéje (és a fájlban szereplő országos határ) egyszer
   * betöltődik a geofences táblába, ha még nincs ilyen nevű game_area sor — később csak aktív/inaktív.
   */
  private async ensureCountyGeofencesSeededFromGeojson(): Promise<void> {
    try {
      for (const [countyCode, countyData] of Object.entries(this.counties)) {
        const existing = await this.geofenceRepository.findOne({
          where: { geofenceType: 'game_area', name: countyData.name },
        });
        if (existing) continue;

        const countyPolygon = countyData.polygon;
        const center = this.calculatePolygonCenter(countyPolygon);
        const radius = this.calculatePolygonRadius(countyPolygon, center);

        await this.geofenceRepository.save(
          this.geofenceRepository.create({
            name: countyData.name,
            centerLat: center.lat,
            centerLon: center.lon,
            radiusM: radius,
            geofenceType: 'game_area',
            active: false,
            metadataJson: {
              countyCode,
              countyName: countyData.name,
              polygon: countyPolygon,
              type: 'polygon',
            } as any,
          }),
        );
      }

      const hasHungary = await this.geofenceRepository.findOne({
        where: { geofenceType: 'game_area', name: 'Magyarország' },
      });
      if (!hasHungary) {
        const hungaryPolygon =
          this.counties['magyarorszag']?.polygon || this.hungaryBoundary || this.getFallbackHungaryBoundary();
        const center = this.calculatePolygonCenter(hungaryPolygon);
        const radius = this.calculatePolygonRadius(hungaryPolygon, center);
        await this.geofenceRepository.save(
          this.geofenceRepository.create({
            name: 'Magyarország',
            centerLat: center.lat,
            centerLon: center.lon,
            radiusM: radius,
            geofenceType: 'game_area',
            active: false,
            metadataJson: {
              activeCounties: [],
              activeRegions: [],
              polygon: hungaryPolygon,
              type: 'polygon',
            } as any,
          }),
        );
      }
    } catch (e) {
      console.error('ensureCountyGeofencesSeededFromGeojson failed:', e);
    }
  }

  async getGameArea() {
    const gameAreaGeofences = await this.geofenceRepository.find({
      where: { geofenceType: 'game_area' },
      order: { createdAt: 'DESC' },
    });

    // Get active geofences
    const activeGeofences = gameAreaGeofences.filter((g) => g.active);

    // Build game area description
    let activeGameArea: string | null = null;
    if (activeGeofences.length > 0) {
      const names = activeGeofences.map((g) => g.name);
      if (names.length === 1) {
        activeGameArea = names[0];
      } else {
        activeGameArea = names.join(', ');
      }
    }

    return {
      activeCounties: gameAreaGeofences
        .filter((g) => g.active && g.metadataJson?.countyCode)
        .map((g) => g.metadataJson.countyCode),
      activeRegions: [],
      activeGameArea: activeGameArea,
      geofences: gameAreaGeofences.map((g) => ({
        id: g.id,
        name: g.name,
        centerLat: parseFloat(g.centerLat.toString()),
        centerLon: parseFloat(g.centerLon.toString()),
        radiusM: g.radiusM,
        active: g.active,
        metadataJson: g.metadataJson,
      })),
    };
  }

  getAvailableCounties() {
    const counties = Object.keys(this.counties).map((code) => ({
      code,
      name: this.counties[code].name,
      polygon: this.counties[code].polygon,
    }));
    return counties;
  }

  async updateGameArea(updateGameAreaDto: UpdateGameAreaDto, userId?: number, audit?: AuditRequestMeta) {
    // Deactivate ALL existing game area geofences first (including "Magyarország")
    // Use update query for better performance
    await this.geofenceRepository.update(
      { geofenceType: 'game_area' },
      { active: false },
    );

    // Also explicitly deactivate "Magyarország" by name
    await this.geofenceRepository.update(
      { geofenceType: 'game_area', name: 'Magyarország' },
      { active: false },
    );

    console.log('Deactivated all game area geofences');

    // If counties are specified, create geofences for each county
    if (updateGameAreaDto.activeCounties && updateGameAreaDto.activeCounties.length > 0) {
      // Create geofence for each selected county
      for (const countyCode of updateGameAreaDto.activeCounties) {
        const countyData = this.counties[countyCode];
        if (countyData) {
          const countyPolygon = countyData.polygon;
          const center = this.calculatePolygonCenter(countyPolygon);
          const radius = this.calculatePolygonRadius(countyPolygon, center);

          // Find existing by county name
          let existing = await this.geofenceRepository.findOne({
            where: { geofenceType: 'game_area', name: countyData.name },
          });

          if (existing) {
            existing.active = true;
            existing.name = countyData.name;
            existing.centerLat = center.lat;
            existing.centerLon = center.lon;
            existing.radiusM = radius;
            existing.metadataJson = {
              countyCode,
              countyName: countyData.name,
              polygon: countyPolygon,
              type: 'polygon',
            } as any;
            await this.geofenceRepository.save(existing);
            console.log(`Updated geofence for ${countyData.name} with polygon`);
          } else {
            const newGeofence = this.geofenceRepository.create({
              name: countyData.name,
              centerLat: center.lat,
              centerLon: center.lon,
              radiusM: radius,
              geofenceType: 'game_area',
              active: true,
              metadataJson: {
                countyCode,
                countyName: countyData.name,
                polygon: countyPolygon,
                type: 'polygon',
              } as any,
            });
            await this.geofenceRepository.save(newGeofence);
            console.log(`Created new geofence for ${countyData.name} with polygon`);
          }
        }
      }
    } else {
      // No counties selected, use full Hungary boundary
      // First try to find "Magyarország" in counties (if it's loaded as a county)
      const hungaryCountyCode = 'magyarország';
      const hungaryCounty = this.counties[hungaryCountyCode];

      let hungaryPolygon: number[][] | null = null;
      if (hungaryCounty) {
        // Use the "Magyarország" county polygon
        hungaryPolygon = hungaryCounty.polygon;
        console.log('Using "Magyarország" county polygon from counties data');
      } else {
        // Fall back to hungaryBoundary
        hungaryPolygon = this.hungaryBoundary || this.getFallbackHungaryBoundary();
        console.log('Using Hungary boundary from separate boundary data');
      }

      if (!hungaryPolygon) {
        throw new Error('Hungary boundary not available');
      }
      const center = this.calculatePolygonCenter(hungaryPolygon);
      const radius = this.calculatePolygonRadius(hungaryPolygon, center);

      const gameAreaGeofence = await this.geofenceRepository.findOne({
        where: { geofenceType: 'game_area', name: 'Magyarország' },
      });

      if (gameAreaGeofence) {
        gameAreaGeofence.active = true;
        gameAreaGeofence.centerLat = center.lat;
        gameAreaGeofence.centerLon = center.lon;
        gameAreaGeofence.radiusM = radius;
        gameAreaGeofence.metadataJson = {
          activeCounties: updateGameAreaDto.activeCounties || [],
          activeRegions: updateGameAreaDto.activeRegions || [],
          polygon: hungaryPolygon,
          type: 'polygon',
        } as any;
        await this.geofenceRepository.save(gameAreaGeofence);
        console.log('Updated Hungary geofence with polygon');
      } else {
        const newGeofence = this.geofenceRepository.create({
          name: 'Magyarország',
          centerLat: center.lat,
          centerLon: center.lon,
          radiusM: radius,
          geofenceType: 'game_area',
          active: true,
          metadataJson: {
            activeCounties: updateGameAreaDto.activeCounties || [],
            activeRegions: updateGameAreaDto.activeRegions || [],
            polygon: hungaryPolygon,
            type: 'polygon',
          } as any,
        });
        await this.geofenceRepository.save(newGeofence);
        console.log('Created new Hungary geofence with polygon');
      }
    }

    await this.redisGeofenceCache.invalidateActiveGeofences();

    // Broadcast update
    this.webSocketGateway.broadcastGameAreaUpdate({
      activeCounties: updateGameAreaDto.activeCounties || [],
      activeRegions: updateGameAreaDto.activeRegions || [],
      updatedBy: userId,
      timestamp: new Date().toISOString(),
    });

    // Audit log
    if (userId) {
      await this.auditLogsService.log({
        userId,
        actionType: 'game_area_update',
        entityType: 'geofence',
        dataJson: updateGameAreaDto,
        ...audit,
      });
    }

    return {
      success: true,
      message: 'Game area updated',
    };
  }

  private getFallbackHungaryBoundary(): number[][] {
    // Fallback boundary if GeoJSON is not available
    return [
      [16.113, 48.111],
      [16.979, 48.123],
      [17.137, 47.808],
      [17.630, 47.705],
      [18.830, 47.758],
      [19.769, 47.992],
      [20.239, 48.328],
      [20.473, 48.562],
      [20.801, 48.623],
      [21.872, 48.319],
      [22.085, 48.422],
      [22.141, 48.096],
      [22.901, 47.985],
      [23.142, 48.096],
      [24.135, 47.985],
      [24.401, 47.758],
      [24.543, 47.758],
      [25.609, 47.758],
      [26.207, 47.705],
      [26.619, 47.758],
      [27.233, 47.758],
      [27.675, 47.758],
      [28.233, 47.758],
      [28.233, 46.758],
      [28.233, 45.758],
      [27.233, 45.758],
      [26.233, 45.758],
      [25.233, 45.758],
      [24.233, 45.758],
      [23.233, 45.758],
      [22.233, 45.758],
      [21.233, 45.758],
      [20.233, 45.758],
      [19.233, 45.758],
      [18.233, 45.758],
      [17.233, 45.758],
      [16.233, 45.758],
      [16.113, 48.111],
    ];
  }

  private calculatePolygonCenter(polygon: number[][]): { lat: number; lon: number } {
    const lats = polygon.map((p) => p[1]);
    const lons = polygon.map((p) => p[0]);
    return {
      lat: (Math.max(...lats) + Math.min(...lats)) / 2,
      lon: (Math.max(...lons) + Math.min(...lons)) / 2,
    };
  }

  private calculatePolygonRadius(polygon: number[][], center: { lat: number; lon: number }): number {
    let maxDist = 0;
    for (const [lon, lat] of polygon) {
      const dist = this.haversineDistance(center.lat, center.lon, lat, lon);
      if (dist > maxDist) maxDist = dist;
    }
    return Math.ceil(maxDist);
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
}
