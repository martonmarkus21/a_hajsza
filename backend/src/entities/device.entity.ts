import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Pair } from './pair.entity';

/** One registered device row per pair (first successful login wins; race-safe with DB unique). */
@Unique(['pairId'])
@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pair, (pair) => pair.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pair_id' })
  pair: Pair;

  @Column({ name: 'pair_id' })
  pairId: number;

  @Column({ unique: true, name: 'imei_or_device_id' })
  imeiOrDeviceId: string;

  @Column({ type: 'text', nullable: true, name: 'fcm_token' })
  fcmToken: string;

  @Column({ nullable: true, name: 'last_seen_at', type: 'timestamp' })
  lastSeenAt: Date | null;

  /** Set on logout; cleared on login. lastSeenAt stays as last real server contact for display. */
  @Column({ nullable: true, name: 'logged_out_at', type: 'timestamp' })
  loggedOutAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}






