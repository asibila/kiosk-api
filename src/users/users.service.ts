import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { hashPassword } from './password.js';

/**
 * Columns safe to expose over HTTP. `passwordHash` is deliberately left out.
 */
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type User = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          isActive: dto.isActive,
        },
        select: userSelect,
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const { password, ...changes } = dto;
    const data: Prisma.UserUpdateInput = { ...changes };

    if (password !== undefined) {
      data.passwordHash = await hashPassword(password);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      this.rethrow(error);
    }
  }

  /**
   * Turns Prisma's known errors into HTTP errors. Anything else is rethrown
   * unchanged, so unexpected failures still surface as a 500.
   */
  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ConflictException('A user with this email already exists');
        case 'P2025':
          throw new NotFoundException('User not found');
      }
    }

    throw error;
  }
}
