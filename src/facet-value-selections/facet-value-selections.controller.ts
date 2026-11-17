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
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
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
    @CurrentUser() user: RequestUser,
  ): Promise<FacetValueSelection> {
    return this.facetValueSelectionsService.create(dto, user);
  }

  @Public()
  @Get()
  findAll(): Promise<FacetValueSelection[]> {
    return this.facetValueSelectionsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<FacetValueSelection> {
    return this.facetValueSelectionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateFacetValueSelectionSchema })
    dto: UpdateFacetValueSelectionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<FacetValueSelection> {
    return this.facetValueSelectionsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.facetValueSelectionsService.remove(id, user);
  }
}
