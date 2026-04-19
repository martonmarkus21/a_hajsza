import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { AdminAuditLogsController } from './admin-audit-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User])],
  controllers: [AdminAuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}






