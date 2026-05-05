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

@Entity('ck_flags')
export class CkFlag {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pair, (pair) => pair.ckFlags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'pair_id' })
  @Index()
  pairId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'flagged_by_user_id' })
  flaggedBy: User;

  @Column({ name: 'flagged_by_user_id' })
  flaggedByUserId: number;

  @Column({ default: true })
  @Index()
  active: boolean;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}






