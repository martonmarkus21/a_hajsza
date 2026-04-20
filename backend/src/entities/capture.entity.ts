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
  @Index('UQ_captures_pair_id_unique', { unique: true })
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

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  @Index('UQ_captures_request_id_unique', { unique: true })
  requestId: string | null;

  @Column({ name: 'client_timestamp', type: 'timestamp', nullable: true })
  clientTimestamp: Date | null;

  /** Elfogás rögzítésének pillanata (UTC, DB: timestamptz). */
  @Column({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;

  /** A rögzítés pillanatában mentett hely (nem feltétlenül egyezik a legutóbbi PG positions sorral). */
  @Column({ name: 'captured_lat', type: 'double precision', nullable: true })
  capturedLat: number | null;

  @Column({ name: 'captured_lon', type: 'double precision', nullable: true })
  capturedLon: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}






