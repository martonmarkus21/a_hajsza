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

  @Column({ name: 'game_enabled', type: 'boolean', default: false })
  gameEnabled: boolean;

  /**
   * Játéknap vége után (ugyanazon naptári napon) a napi bázisponthoz képest max. ennyi km távolság
   * (Redis-anchored pozíció a játékablak zárásakor).
   */
  @Column({ name: 'stay_rule_enabled', type: 'boolean', default: false })
  stayRuleEnabled: boolean;

  @Column({ name: 'stay_radius_km', type: 'float', default: 5 })
  stayRadiusKm: number;

  /** Páros Android kliens fejléc-titok (auto-generált az admin felületen); a MOBILE_ENROLLMENT_SECRET .env felülírhatja. */
  @Column({ name: 'mobile_enrollment_secret', type: 'varchar', length: 255, nullable: true })
  mobileEnrollmentSecret: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}



