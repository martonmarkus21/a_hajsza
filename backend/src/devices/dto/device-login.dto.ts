import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class DeviceLoginDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;
}





