import { Module } from '@nestjs/common';
import { DescriptionsModule } from '../descriptions/descriptions.module.js';
import { FacetSchemasController } from './facet-schemas.controller.js';
import { FacetSchemasService } from './facet-schemas.service.js';

@Module({
  imports: [DescriptionsModule],
  controllers: [FacetSchemasController],
  providers: [FacetSchemasService],
  exports: [FacetSchemasService],
})
export class FacetSchemasModule {}
