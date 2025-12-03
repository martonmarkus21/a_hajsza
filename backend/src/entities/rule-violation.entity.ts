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
import { Position } from './position.entity';

@Entity('rule_violations')
export class RuleViolation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pair, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'pair_id' })
  @Index()
  pairId: number;

  @Column({ name: 'violation_type' })
  violationType: string; // 'game_area_exit', 'vehicle_time_exceeded', 'crossing_point_violation'

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Position, { nullable: true })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ nullable: true, name: 'position_id' })
  positionId: number;

  @Column({ default: false })
  @Index()
  resolved: boolean;

  @Column({ nullable: true, name: 'resolved_at', type: 'timestamp' })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}






