import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsEmail({}, { message: 'Érvénytelen email cím formátum' })
    email?: string;

    @IsOptional()
    @IsString()
    currentPassword?: string;

    @IsOptional()
    @IsString()
    @MinLength(6, { message: 'Az új jelszónak legalább 6 karakter hosszúnak kell lennie' })
    newPassword?: string;
}
