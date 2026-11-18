import { Module } from '@nestjs/common';
import { ListingEventsController } from './listing-events.controller.js';
import { ListingEventsService } from './listing-events.service.js';

@Module({
  controllers: [ListingEventsController],
  providers: [ListingEventsService],
  exports: [ListingEventsService],
})
export class ListingEventsModule {}
