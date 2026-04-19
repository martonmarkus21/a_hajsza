import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class QueryAdminAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  /** Szűrés action_type szerint; üres vagy "all" = mind */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actionType?: string;

  /** entity_type; üres vagy "all" = mind */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  /** Keresés: IP, user-agent, JSON, felhasználónév (ILIKE) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize = 50;

  @IsOptional()
  @IsIn([
    'timestamp',
    'id',
    'actionType',
    'username',
    'entityType',
    'entityId',
    'ipAddress',
  ])
  sortBy:
    | 'timestamp'
    | 'id'
    | 'actionType'
    | 'username'
    | 'entityType'
    | 'entityId'
    | 'ipAddress' = 'timestamp';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';
}
