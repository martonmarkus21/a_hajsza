import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Pair } from './pair.entity';

/** Mentéskor beágyazott egyedi (scenario) kör — a geofence sor később törölhető. */
export type SavedScenarioZone = {
  name?: string;
  lat: number;
  lon: number;
  radiusM: number;
};

/**
 * Mentéskor: aktív fix játékterület geofence ID-k (a geofences táblából olvasható) +
 * egyedi körök adatai (beágyazva, mert törölhetők).
 */
export type SavedAreaContext = {
  gameAreaGeofenceIds: number[];
  scenarioZones: SavedScenarioZone[];
};

@Entity('positions')
@Index(['pairId', 'timestamp'])
export class Position {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pair, (pair) => pair.positions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'pair_id' })
  @Index()
  pairId: number;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  lon: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  accuracy: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  speed: number;

  @Column({ default: false, name: 'vehicle_mode' })
  vehicleMode: boolean;

  @Column({ nullable: true, name: 'vehicle_session_remaining', type: 'int' })
  vehicleSessionRemaining: number;

  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ default: false, name: 'had_rule_violation_at_save' })
  hadRuleViolationAtSave: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'saved_area_context_json' })
  savedAreaContextJson: SavedAreaContext | null;
}
