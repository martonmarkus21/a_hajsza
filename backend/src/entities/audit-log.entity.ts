import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true, name: 'user_id' })
  @Index()
  userId: number;

  @Column({ name: 'action_type' })
  @Index()
  actionType: string;

  @Column({ nullable: true, name: 'entity_type' })
  entityType: string;

  @Column({ nullable: true, name: 'entity_id' })
  entityId: number;

  @Column({ type: 'jsonb', nullable: true, name: 'data_json' })
  dataJson: any;

  @Column({ nullable: true, name: 'ip_address', length: 45 })
  ipAddress: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  timestamp: Date;
}






