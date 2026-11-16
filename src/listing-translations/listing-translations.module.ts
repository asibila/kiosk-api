import { Module } from '@nestjs/common';
import { ListingTranslationsController } from './listing-translations.controller.js';
import { ListingTranslationsService } from './listing-translations.service.js';

@Module({
  controllers: [ListingTranslationsController],
  providers: [ListingTranslationsService],
  exports: [ListingTranslationsService],
})
export class ListingTranslationsModule {}
