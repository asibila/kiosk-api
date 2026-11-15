import { Module } from '@nestjs/common';
import { FacetValueOptionsController } from './facet-value-options.controller.js';
import { FacetValueOptionsService } from './facet-value-options.service.js';

@Module({
  controllers: [FacetValueOptionsController],
  providers: [FacetValueOptionsService],
  exports: [FacetValueOptionsService],
})
export class FacetValueOptionsModule {}
