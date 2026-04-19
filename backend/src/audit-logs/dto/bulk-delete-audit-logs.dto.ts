import { IsIn } from 'class-validator';

export class BulkDeleteAuditLogsDto {
  @IsIn(['filtered', 'all'])
  scope: 'filtered' | 'all';
}
