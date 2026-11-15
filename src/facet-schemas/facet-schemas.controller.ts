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
  createFacetSchemaSchema,
  type CreateFacetSchemaDto,
} from './dto/create-facet-schema.dto.js';
import {
  updateFacetSchemaSchema,
  type UpdateFacetSchemaDto,
} from './dto/update-facet-schema.dto.js';
import {
  FacetSchemasService,
  type FacetSchema,
} from './facet-schemas.service.js';

@Controller('facet-schemas')
export class FacetSchemasController {
  constructor(private readonly facetSchemasService: FacetSchemasService) {}

  @Post()
  create(
    @Body({ schema: createFacetSchemaSchema }) dto: CreateFacetSchemaDto,
    @ActorId() actorId: number | null,
  ): Promise<FacetSchema> {
    return this.facetSchemasService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<FacetSchema[]> {
    return this.facetSchemasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<FacetSchema> {
    return this.facetSchemasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateFacetSchemaSchema }) dto: UpdateFacetSchemaDto,
    @ActorId() actorId: number | null,
  ): Promise<FacetSchema> {
    return this.facetSchemasService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.facetSchemasService.remove(id);
  }
}
