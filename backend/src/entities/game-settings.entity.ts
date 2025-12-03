import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('game_settings')
export class GameSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'location_update_interval_minutes', type: 'int', default: 20 })
  locationUpdateIntervalMinutes: number;

  @Column({ name: 'last_location_update', type: 'timestamp', nullable: true })
  lastLocationUpdate: Date | null;

  @Column({ name: 'next_location_update', type: 'timestamp', nullable: true })
  nextLocationUpdate: Date | null;

  @Column({ name: 'is_timer_running', type: 'boolean', default: false })
  isTimerRunning: boolean;

  @Column({ name: 'allow_position_updates_for_map', type: 'boolean', default: false })
  allowPositionUpdatesForMap: boolean;

  @Column({ name: 'pairs_sent_position_this_cycle', type: 'simple-array', nullable: true })
  pairsSentPositionThisCycle: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}



