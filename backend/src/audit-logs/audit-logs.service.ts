import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogData {
  userId?: number;
  actionType: string;
  entityType?: string;
  entityId?: number;
  dataJson?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: AuditLogData) {
    const auditLog = this.auditLogRepository.create({
      userId: data.userId,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId,
      dataJson: data.dataJson,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    await this.auditLogRepository.save(auditLog);
    return auditLog;
  }
}






