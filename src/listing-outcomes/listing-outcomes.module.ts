import { Module } from '@nestjs/common';
import { ListingOutcomesController } from './listing-outcomes.controller.js';
import { ListingOutcomesService } from './listing-outcomes.service.js';

@Module({
  controllers: [ListingOutcomesController],
  providers: [ListingOutcomesService],
})
export class ListingOutcomesModule {}
