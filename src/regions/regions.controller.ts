import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { clientIpFromHeaders } from './ip-region.service.js';
import {
  RegionsService,
  type DetectedRegion,
  type RegionRow,
} from './regions.service.js';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  findAll(): Promise<RegionRow[]> {
    return this.regionsService.findAll();
  }

  /**
   * Region for this visitor, from the address the proxy reports. Always answers
   * 200: a failed or private-IP lookup falls back to `regionId: 0`.
   */
  @Get('detect')
  detect(@Req() request: Request): Promise<DetectedRegion> {
    const ip = clientIpFromHeaders(
      request.headers,
      request.socket?.remoteAddress ?? null,
    );
    return this.regionsService.detect(ip);
  }
}
