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
  createFacetValueOptionSchema,
  type CreateFacetValueOptionDto,
} from './dto/create-facet-value-option.dto.js';
import {
  updateFacetValueOptionSchema,
  type UpdateFacetValueOptionDto,
} from './dto/update-facet-value-option.dto.js';
import {
  FacetValueOptionsService,
  type FacetValueOption,
} from './facet-value-options.service.js';

@Controller('facet-value-options')
export class FacetValueOptionsController {
  constructor(
    private readonly facetValueOptionsService: FacetValueOptionsService,
  ) {}

  @Roles('ADMIN')
  @Post()
  create(
    @Body({ schema: createFacetValueOptionSchema })
    dto: CreateFacetValueOptionDto,
    @ActorId() actorId: number | null,
  ): Promise<FacetValueOption> {
    return this.facetValueOptionsService.create(dto, actorId);
  }

  @Public()
  @Get()
  findAll(): Promise<FacetValueOption[]> {
    return this.facetValueOptionsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<FacetValueOption> {
    return this.facetValueOptionsService.findOne(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateFacetValueOptionSchema })
    dto: UpdateFacetValueOptionDto,
    @ActorId() actorId: number | null,
  ): Promise<FacetValueOption> {
    return this.facetValueOptionsService.update(id, dto, actorId);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.facetValueOptionsService.remove(id);
  }
}
