import { Module } from '@nestjs/common';
import { FacetValueSelectionsController } from './facet-value-selections.controller.js';
import { FacetValueSelectionsService } from './facet-value-selections.service.js';

@Module({
  controllers: [FacetValueSelectionsController],
  providers: [FacetValueSelectionsService],
  exports: [FacetValueSelectionsService],
})
export class FacetValueSelectionsModule {}
