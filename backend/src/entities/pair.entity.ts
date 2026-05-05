import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Device } from './device.entity';
import { Position } from './position.entity';
import { Capture } from './capture.entity';
import { CkFlag } from './ck-flag.entity';

@Entity('pairs')
export class Pair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  assignedNumber: number;

  @Column({ nullable: true })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Device, (device) => device.pair)
  devices: Device[];

  @OneToMany(() => Position, (position) => position.pair)
  positions: Position[];

  @OneToMany(() => Capture, (capture) => capture.pair)
  captures: Capture[];

  @OneToMany(() => CkFlag, (ckFlag) => ckFlag.pair)
  ckFlags: CkFlag[];
}






