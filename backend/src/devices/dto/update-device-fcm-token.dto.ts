import { IsOptional, IsString } from 'class-validator';

export class UpdateDeviceFcmTokenDto {
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
