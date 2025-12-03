import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Geofence } from './geofence.entity';
import { Pair } from './pair.entity';
import { Position } from './position.entity';

@Entity('geofence_completions')
@Unique(['geofenceId', 'pairId'])
export class GeofenceCompletion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Geofence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'geofence_id' })
  geofence: Geofence;

  @Column({ name: 'geofence_id' })
  @Index()
  geofenceId: number;

  @ManyToOne(() => Pair, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'pair_id' })
  @Index()
  pairId: number;

  @ManyToOne(() => Position, { nullable: true })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ nullable: true, name: 'position_id' })
  positionId: number;

  @CreateDateColumn({ name: 'completed_at' })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}






