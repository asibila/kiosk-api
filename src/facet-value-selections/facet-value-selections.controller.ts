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
import {
  createFacetValueSelectionSchema,
  type CreateFacetValueSelectionDto,
} from './dto/create-facet-value-selection.dto.js';
import {
  updateFacetValueSelectionSchema,
  type UpdateFacetValueSelectionDto,
} from './dto/update-facet-value-selection.dto.js';
import {
  FacetValueSelectionsService,
  type FacetValueSelection,
} from './facet-value-selections.service.js';

@Controller('facet-value-selections')
export class FacetValueSelectionsController {
  constructor(
    private readonly facetValueSelectionsService: FacetValueSelectionsService,
  ) {}

  @Post()
  create(
    @Body({ schema: createFacetValueSelectionSchema })
    dto: CreateFacetValueSelectionDto,
    @ActorId() actorId: number | null,
  ): Promise<FacetValueSelection> {
    return this.facetValueSelectionsService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<FacetValueSelection[]> {
    return this.facetValueSelectionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<FacetValueSelection> {
    return this.facetValueSelectionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateFacetValueSelectionSchema })
    dto: UpdateFacetValueSelectionDto,
    @ActorId() actorId: number | null,
  ): Promise<FacetValueSelection> {
    return this.facetValueSelectionsService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.facetValueSelectionsService.remove(id);
  }
}
