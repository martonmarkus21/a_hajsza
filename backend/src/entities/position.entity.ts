import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pair } from './pair.entity';

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

  /** Mentéskor aktív játékterület(ek) pillanatképe (admin térképnézet). */
  @Column({ type: 'jsonb', nullable: true, name: 'game_area_snapshot_json' })
  gameAreaSnapshotJson: Record<string, unknown>[] | null;

  /** Mentéskor volt-e fel nem oldott szabályszegése a párnak (pillanatkép, nem változik). */
  @Column({ default: false, name: 'had_rule_violation_at_save' })
  hadRuleViolationAtSave: boolean;
}






