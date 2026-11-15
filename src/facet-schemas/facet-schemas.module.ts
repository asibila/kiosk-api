import { Module } from '@nestjs/common';
import { FacetSchemasController } from './facet-schemas.controller.js';
import { FacetSchemasService } from './facet-schemas.service.js';

@Module({
  controllers: [FacetSchemasController],
  providers: [FacetSchemasService],
  exports: [FacetSchemasService],
})
export class FacetSchemasModule {}
