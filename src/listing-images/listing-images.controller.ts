import {
  BadRequestException,
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
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import {
  updateListingImageSchema,
  type UpdateListingImageDto,
} from './dto/update-listing-image.dto.js';
import {
  ListingImagesService,
  MAX_IMAGE_BYTES,
  type ListingImageDto,
  type UploadedImage,
} from './listing-images.service.js';
import { UploadExceptionFilter } from './upload-exception.filter.js';

/**
 * Listing images. Uploads arrive as `multipart/form-data` (`file` + `listingId`)
 * and are served back as raw bytes so browsers can use them as `<img src>`.
 */
@Controller('listing-images')
export class ListingImagesController {
  constructor(private readonly listingImages: ListingImagesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @UseFilters(UploadExceptionFilter)
  create(
    @UploadedFile() file: UploadedImage | undefined,
    @Body() body: Record<string, unknown> | undefined,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingImageDto> {
    if (!file) {
      throw new BadRequestException(
        'A "file" field containing the image is required',
      );
    }

    const listingId = Number(body?.listingId);
    if (!Number.isInteger(listingId) || listingId <= 0) {
      throw new BadRequestException('listingId must be a positive integer');
    }

    return this.listingImages.create(listingId, file, user);
  }

  @Public()
  @Get()
  findAll(@Query('listingId') listingId?: string): Promise<ListingImageDto[]> {
    if (listingId === undefined) return this.listingImages.findAll();

    const parsed = Number(listingId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('listingId must be a positive integer');
    }
    return this.listingImages.findAll(parsed);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ListingImageDto> {
    return this.listingImages.findOne(id);
  }

  @Public()
  @Get(':id/file')
  async file(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.listingImages.getFile(id);

    response.set({
      'Content-Type': image.mimeType,
      'Content-Length': String(image.size),
      'Cache-Control': 'private, max-age=31536000, immutable',
    });

    return new StreamableFile(image.bytes);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateListingImageSchema }) dto: UpdateListingImageDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ListingImageDto> {
    return this.listingImages.setPrimary(id, dto.primaryImage, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.listingImages.remove(id, user);
  }
}
