import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleViolation } from '../entities/rule-violation.entity';
import { Position } from '../entities/position.entity';
import { Geofence } from '../entities/geofence.entity';
import { GeofenceCompletion } from '../entities/geofence-completion.entity';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { GameDaysService } from '../game-days/game-days.service';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class RuleViolationsService {
  constructor(
    @InjectRepository(RuleViolation)
    private ruleViolationRepository: Repository<RuleViolation>,
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
    @InjectRepository(GeofenceCompletion)
    private geofenceCompletionRepository: Repository<GeofenceCompletion>,
    private webSocketGateway: WebSocketGateway,
    private gameDaysService: GameDaysService,
    private fcmService: FcmService,
  ) {}

  async checkViolations(pairId: number, position: Position): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    // Check game area exit
    const gameAreaGeofences = await this.geofenceRepository.find({
      where: { geofenceType: 'game_area', active: true },
    });

    if (gameAreaGeofences.length > 0) {
      const isInsideGameArea = gameAreaGeofences.some((geofence) =>
        this.isPointInCircle(
          parseFloat(position.lat.toString()),
          parseFloat(position.lon.toString()),
          parseFloat(geofence.centerLat.toString()),
          parseFloat(geofence.centerLon.toString()),
          geofence.radiusM,
        ),
      );

      if (!isInsideGameArea) {
        // Check if violation already exists and is not resolved
        const existingViolation = await this.ruleViolationRepository.findOne({
          where: {
            pairId,
            violationType: 'game_area_exit',
            resolved: false,
          },
        });

        if (!existingViolation) {
          const violation = this.ruleViolationRepository.create({
            pairId,
            violationType: 'game_area_exit',
            description: 'Pár kilépett a játéktérből',
            positionId: position.id,
            resolved: false,
          });

          const savedViolation = await this.ruleViolationRepository.save(violation);
          violations.push(savedViolation);

          // Broadcast violation
          this.webSocketGateway.broadcastRuleViolation({
            pairId,
            violationType: 'game_area_exit',
            description: 'Pár kilépett a játéktérből',
            continuousMode: true,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Resolve existing violation if back in game area
        await this.ruleViolationRepository.update(
          {
            pairId,
            violationType: 'game_area_exit',
            resolved: false,
          },
          { resolved: true, resolvedAt: new Date() },
        );
      }
    }

    // Check vehicle time limit violations
    if (position.vehicleMode && position.vehicleSessionRemaining !== null) {
      if (position.vehicleSessionRemaining <= 0) {
        const existingViolation = await this.ruleViolationRepository.findOne({
          where: {
            pairId,
            violationType: 'vehicle_time_exceeded',
            resolved: false,
          },
        });

        if (!existingViolation) {
          const violation = this.ruleViolationRepository.create({
            pairId,
            violationType: 'vehicle_time_exceeded',
            description: 'Járműhasználati idő limit túllépve (40 perc)',
            positionId: position.id,
            resolved: false,
          });

          const savedViolation = await this.ruleViolationRepository.save(violation);
          violations.push(savedViolation);

          this.webSocketGateway.broadcastRuleViolation({
            pairId,
            violationType: 'vehicle_time_exceeded',
            description: 'Járműhasználati idő limit túllépve',
            continuousMode: true,
            timestamp: new Date().toISOString(),
          });

          // Send push notification
          await this.fcmService.sendToPair(pairId, {
            title: 'Szabálysértés!',
            body: 'A 40 perces járműhasználati idő lejárt!',
          });
        }
      }
    }


    // Check geofence completions (scenarios)
    await this.checkGeofenceCompletions(pairId, position);

    return violations;
  }

  private async checkGeofenceCompletions(pairId: number, position: Position) {
    const activeGeofences = await this.geofenceRepository.find({
      where: { geofenceType: 'scenario', active: true },
    });

    for (const geofence of activeGeofences) {
      // Check if already completed
      const existing = await this.geofenceCompletionRepository.findOne({
        where: { geofenceId: geofence.id, pairId },
      });

      if (existing) continue;

      // Check if within geofence
      const isInside = this.isPointInCircle(
        parseFloat(position.lat.toString()),
        parseFloat(position.lon.toString()),
        parseFloat(geofence.centerLat.toString()),
        parseFloat(geofence.centerLon.toString()),
        geofence.radiusM,
      );

      if (isInside) {
        // Check time window if specified
        const now = new Date();
        if (geofence.activeFrom && now < geofence.activeFrom) continue;
        if (geofence.activeUntil && now > geofence.activeUntil) continue;

        // Create completion
        const completion = this.geofenceCompletionRepository.create({
          geofenceId: geofence.id,
          pairId,
          positionId: position.id,
        });
        await this.geofenceCompletionRepository.save(completion);

        // Broadcast completion
        this.webSocketGateway.broadcastGeofenceAlert({
          type: 'completion',
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          pairId,
          timestamp: new Date().toISOString(),
        });

        // Send push notification
        await this.fcmService.sendToPair(pairId, {
          title: 'Feladat teljesítve!',
          body: `Sikeresen teljesítetted: ${geofence.name}`,
        });
      }
    }
  }

  private isPointInCircle(
    lat: number,
    lon: number,
    centerLat: number,
    centerLon: number,
    radiusM: number,
  ): boolean {
    const distance = this.calculateDistance(lat, lon, centerLat, centerLon);
    return distance <= radiusM;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

