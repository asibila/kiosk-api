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
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  createDescriptionSchema,
  type CreateDescriptionDto,
} from './dto/create-description.dto.js';
import {
  updateDescriptionSchema,
  type UpdateDescriptionDto,
} from './dto/update-description.dto.js';
import {
  DescriptionsService,
  type Description,
} from './descriptions.service.js';

@Controller('descriptions')
export class DescriptionsController {
  constructor(private readonly descriptionsService: DescriptionsService) {}

  @Roles('ADMIN')
  @Post()
  create(
    @Body({ schema: createDescriptionSchema }) dto: CreateDescriptionDto,
    @ActorId() actorId: number | null,
  ): Promise<Description> {
    return this.descriptionsService.create(dto, actorId);
  }

  @Public()
  @Get()
  findAll(): Promise<Description[]> {
    return this.descriptionsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Description> {
    return this.descriptionsService.findOne(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateDescriptionSchema }) dto: UpdateDescriptionDto,
    @ActorId() actorId: number | null,
  ): Promise<Description> {
    return this.descriptionsService.update(id, dto, actorId);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.descriptionsService.remove(id);
  }
}
