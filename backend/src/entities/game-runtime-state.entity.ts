import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CampaignStatus = 'IDLE' | 'RUNNING' | 'PAUSED_BETWEEN_DAYS' | 'FINISHED';

@Entity('game_runtime_state')
export class GameRuntimeState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'campaign_status', type: 'varchar', default: 'IDLE' })
  campaignStatus: CampaignStatus;

  @Column({ name: 'active_game_day_id', type: 'int', nullable: true })
  activeGameDayId: number | null;

  @Column({ name: 'current_cycle_start_at', type: 'timestamp', nullable: true })
  currentCycleStartAt: Date | null;

  @Column({ name: 'current_cycle_end_at', type: 'timestamp', nullable: true })
  currentCycleEndAt: Date | null;

  @Column({ name: 'allow_position_updates_for_map', type: 'boolean', default: false })
  allowPositionUpdatesForMap: boolean;

  @Column({ name: 'last_cycle_turn_at', type: 'timestamp', nullable: true })
  lastCycleTurnAt: Date | null;

  @Column({ name: 'last_map_position_at', type: 'timestamp', nullable: true })
  lastMapPositionAt: Date | null;

  @Column({ name: 'pairs_sent_position_this_cycle', type: 'simple-array', nullable: true })
  pairsSentPositionThisCycle: number[] | null;

  @Column({ name: 'last_applied_area_schedule_key', type: 'varchar', nullable: true })
  lastAppliedAreaScheduleKey: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

