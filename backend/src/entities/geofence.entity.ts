import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('geofences')
export class Geofence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, name: 'center_lat' })
  centerLat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, name: 'center_lon' })
  centerLon: number;

  @Column({ name: 'radius_m', type: 'int' })
  radiusM: number;

  @Column({ default: true })
  @Index()
  active: boolean;

  @Column({ nullable: true, name: 'active_from', type: 'timestamp' })
  activeFrom: Date;

  @Column({ nullable: true, name: 'active_until', type: 'timestamp' })
  activeUntil: Date;

  @Column({ name: 'geofence_type' })
  @Index()
  geofenceType: string; // 'game_area', 'scenario', 'crossing_point'

  @Column({ type: 'jsonb', nullable: true, name: 'metadata_json' })
  metadataJson: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}






