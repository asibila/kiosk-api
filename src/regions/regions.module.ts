import { Module } from '@nestjs/common';
import { IpRegionService } from './ip-region.service.js';
import { RegionsController } from './regions.controller.js';
import { RegionsService } from './regions.service.js';

@Module({
  controllers: [RegionsController],
  providers: [RegionsService, IpRegionService],
  exports: [RegionsService, IpRegionService],
})
export class RegionsModule {}
