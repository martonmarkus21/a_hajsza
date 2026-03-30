import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryAdminPositionsDto {
  /** Szűrés egy adott pár ID-jára */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pairId?: number;

  /** Inkluzív alsó határ (timestamp), ISO string */
  @IsOptional()
  @IsString()
  from?: string;

  /** Inkluzív felső határ (timestamp), ISO string */
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
  @Max(5000)
  pageSize = 25;

  @IsOptional()
  @IsIn(['timestamp', 'id', 'pairId'])
  sortBy: 'timestamp' | 'id' | 'pairId' = 'timestamp';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';
}
