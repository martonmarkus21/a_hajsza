import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.active) {
      throw new UnauthorizedException('User is inactive');
    }

    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: [{ username: registerDto.username }, { email: registerDto.email }],
    });

    if (existingUser) {
      throw new UnauthorizedException('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const user = this.userRepository.create({
      username: registerDto.username,
      email: registerDto.email,
      passwordHash,
      role: registerDto.role || 'officer',
      active: true,
    });

    const savedUser = await this.userRepository.save(user);
    const { passwordHash: _, ...result } = savedUser;
    return result;
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update email if provided
    if (dto.email !== undefined && dto.email !== user.email) {
      if (dto.email) {
        const existingEmail = await this.userRepository.findOne({ where: { email: dto.email } });
        if (existingEmail && existingEmail.id !== userId) {
          throw new BadRequestException('Ez az email cím már használatban van');
        }
      }
      user.email = dto.email || null;
    }

    // Update password if provided
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('A jelenlegi jelszó megadása kötelező');
      }
      const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('A jelenlegi jelszó helytelen');
      }
      user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    await this.userRepository.save(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}






