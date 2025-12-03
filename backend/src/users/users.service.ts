import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAll() {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
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

  async create(createUserDto: CreateUserDto, createdByUserId: number) {
    // Check if username already exists
    const existingUsername = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existingUsername) {
      throw new BadRequestException('Username already exists');
    }

    // Check if email already exists (if provided)
    if (createUserDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepository.create({
      username: createUserDto.username,
      email: createUserDto.email || null,
      passwordHash,
      role: createUserDto.role,
      active: createUserDto.active !== undefined ? createUserDto.active : true,
    });

    const savedUser = await this.userRepository.save(user);

    // Audit log
    await this.auditLogsService.log({
      userId: createdByUserId,
      actionType: 'user_create',
      entityType: 'user',
      entityId: savedUser.id,
      dataJson: { username: savedUser.username, role: savedUser.role },
    });

    return {
      id: savedUser.id,
      username: savedUser.username,
      email: savedUser.email,
      role: savedUser.role,
      active: savedUser.active,
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto, updatedByUserId: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if username already exists (if changing)
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (existingUsername) {
        throw new BadRequestException('Username already exists');
      }
      user.username = updateUserDto.username;
    }

    // Check if email already exists (if changing)
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
      user.email = updateUserDto.email;
    }

    // Update password if provided
    if (updateUserDto.password) {
      user.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Update role if provided
    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }

    // Update active status if provided
    if (updateUserDto.active !== undefined) {
      user.active = updateUserDto.active;
    }

    await this.userRepository.save(user);

    // Audit log
    await this.auditLogsService.log({
      userId: updatedByUserId,
      actionType: 'user_update',
      entityType: 'user',
      entityId: id,
      dataJson: updateUserDto,
    });

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

  async delete(id: number, deletedByUserId: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting yourself
    if (id === deletedByUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    await this.userRepository.remove(user);

    // Audit log
    await this.auditLogsService.log({
      userId: deletedByUserId,
      actionType: 'user_delete',
      entityType: 'user',
      entityId: id,
      dataJson: { username: user.username },
    });

    return {
      success: true,
      message: 'User deleted',
    };
  }
}




