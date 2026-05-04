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
  violationType: string; // 'game_area_exit' | 'vehicle_time_exceeded' | 'end_of_day_stay'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  @Index()
  resolved: boolean;

  @Column({ nullable: true, name: 'resolved_at', type: 'timestamptz' })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}






