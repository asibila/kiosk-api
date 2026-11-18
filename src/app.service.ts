import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /** Round-trips a trivial query so the health check covers the database too. */
  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
