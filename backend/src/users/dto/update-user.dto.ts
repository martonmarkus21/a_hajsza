import { IsString, IsEmail, IsOptional, IsEnum, MinLength, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString({ message: 'A felhasználónévnek szövegnek kell lennie' })
  @MinLength(3, { message: 'A felhasználónévnek legalább 3 karakter hosszúnak kell lennie' })
  @IsOptional()
  username?: string;

  @IsEmail({}, { message: 'Érvénytelen email cím formátum' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'A jelszónak szövegnek kell lennie' })
  @MinLength(6, { message: 'A jelszónak legalább 6 karakter hosszúnak kell lennie' })
  @IsOptional()
  password?: string;

  @IsEnum(['admin', 'officer'], { message: 'A szerepkör csak admin vagy officer lehet' })
  @IsOptional()
  role?: 'admin' | 'officer';

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}




