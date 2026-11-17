import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from './password.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import {
  authUserSelect,
  publicUserSelect,
  type AuthUser,
  type PublicUser,
} from './user-select.js';

export type User = AuthUser;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Public registration. The role and activation are fixed here so a caller
   * cannot create an admin through `POST /users`.
   */
  async create(dto: CreateUserDto, _actorId: number | null = null): Promise<User> {
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: 'USER',
          isActive: true,
        },
        select: authUserSelect,
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  /** Admins see the full rows; everyone else only gets id + name. */
  findAll(
    requester: RequestUser | null,
  ): Promise<Array<User | PublicUser>> {
    if (this.access.isAdmin(requester)) {
      return this.prisma.user.findMany({
        select: authUserSelect,
        orderBy: { id: 'asc' },
      });
    }

    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(
    id: number,
    requester: RequestUser | null,
  ): Promise<User | PublicUser> {
    const self = requester?.id === id || this.access.isAdmin(requester);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: self ? authUserSelect : publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  /**
   * Self-service edits are limited to name and password. Only an admin can
   * change the email, role or activation of another account.
   */
  async update(
    id: number,
    dto: UpdateUserDto,
    requester: RequestUser,
  ): Promise<User> {
    const admin = this.access.isAdmin(requester);
    if (!admin && requester.id !== id) {
      throw new ForbiddenException('You can only edit your own account');
    }

    if (!admin) {
      const forbidden = Object.keys(dto).filter(
        (key) => key !== 'name' && key !== 'password',
      );
      if (forbidden.length > 0) {
        throw new ForbiddenException(
          'Only name and password can be changed on your own account',
        );
      }
    }

    const { password, ...changes } = dto;
    const data: Prisma.UserUpdateInput = { ...changes };

    if (password !== undefined) {
      data.passwordHash = await hashPassword(password);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: authUserSelect,
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  /** Deleting accounts is an admin action. */
  async remove(id: number, requester: RequestUser | null): Promise<void> {
    if (!this.access.isAdmin(requester)) {
      throw new ForbiddenException('Only an admin can delete users');
    }

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
