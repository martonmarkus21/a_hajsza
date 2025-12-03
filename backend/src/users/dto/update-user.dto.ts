import { IsString, IsEmail, IsOptional, IsEnum, MinLength, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsEnum(['admin', 'officer'])
  @IsOptional()
  role?: 'admin' | 'officer';

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}




