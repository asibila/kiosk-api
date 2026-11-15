import { Module } from '@nestjs/common';
import { ListingImagesController } from './listing-images.controller.js';
import { ListingImagesService } from './listing-images.service.js';

@Module({
  controllers: [ListingImagesController],
  providers: [ListingImagesService],
  exports: [ListingImagesService],
})
export class ListingImagesModule {}
