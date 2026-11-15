import { Module } from '@nestjs/common';
import { DescriptionsModule } from '../descriptions/descriptions.module.js';
import { FacetValueOptionsController } from './facet-value-options.controller.js';
import { FacetValueOptionsService } from './facet-value-options.service.js';

@Module({
  imports: [DescriptionsModule],
  controllers: [FacetValueOptionsController],
  providers: [FacetValueOptionsService],
  exports: [FacetValueOptionsService],
})
export class FacetValueOptionsModule {}
