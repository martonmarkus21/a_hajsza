import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsNumber()
  pairId?: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  body: string;
}





