import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ActorId } from '../audit/actor-id.decorator.js';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { createUserSchema, type CreateUserDto } from './dto/create-user.dto.js';
import { updateUserSchema, type UpdateUserDto } from './dto/update-user.dto.js';
import {
  UsersService,
  type User,
} from './users.service.js';
import type { PublicUser } from './user-select.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post()
  create(
    @Body({ schema: createUserSchema }) dto: CreateUserDto,
    @ActorId() actorId: number | null,
  ): Promise<User> {
    return this.usersService.create(dto, actorId);
  }

  @Public()
  @Get()
  findAll(
    @CurrentUser() requester: RequestUser | null,
  ): Promise<Array<User | PublicUser>> {
    return this.usersService.findAll(requester);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() requester: RequestUser | null,
  ): Promise<User | PublicUser> {
    return this.usersService.findOne(id, requester);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateUserSchema }) dto: UpdateUserDto,
    @CurrentUser() requester: RequestUser,
  ): Promise<User> {
    return this.usersService.update(id, dto, requester);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() requester: RequestUser,
  ): Promise<void> {
    return this.usersService.remove(id, requester);
  }
}
