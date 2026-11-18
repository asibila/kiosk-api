import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/public.decorator.js';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Render's health check: proves the process answers and the DB is reachable. */
  @Get('healthz')
  async health(): Promise<{ status: 'ok'; database: 'ok' }> {
    await this.appService.ping();
    return { status: 'ok', database: 'ok' };
  }
}
