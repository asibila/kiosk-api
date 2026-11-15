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
  createCategorySchema,
  type CreateCategoryDto,
} from './dto/create-category.dto.js';
import {
  updateCategorySchema,
  type UpdateCategoryDto,
} from './dto/update-category.dto.js';
import { CategoriesService, type Category } from './categories.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(
    @Body({ schema: createCategorySchema }) dto: CreateCategoryDto,
    @ActorId() actorId: number | null,
  ): Promise<Category> {
    return this.categoriesService.create(dto, actorId);
  }

  @Get()
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Category> {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateCategorySchema }) dto: UpdateCategoryDto,
    @ActorId() actorId: number | null,
  ): Promise<Category> {
    return this.categoriesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
