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
import { User } from './user.entity';
import { Position } from './position.entity';

@Entity('captures')
export class Capture {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pair, (pair) => pair.captures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'pair_id' })
  @Index()
  pairId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'captured_by_user_id' })
  capturedBy: User;

  @Column({ name: 'captured_by_user_id' })
  capturedByUserId: number;

  @ManyToOne(() => Position, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: Position;

  @Column({ nullable: true, name: 'location_id' })
  locationId: number;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}






