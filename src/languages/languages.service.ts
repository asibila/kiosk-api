import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { auditSelect } from '../audit/audit-select.js';
import { PrismaService } from '../prisma/prisma.service.js';

const languageSelect = {
  code: true,
  name: true,
  ...auditSelect,
} satisfies Prisma.LanguageSelect;

export type Language = Prisma.LanguageGetPayload<{
  select: typeof languageSelect;
}>;

@Injectable()
export class LanguagesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Language[]> {
    return this.prisma.language.findMany({
      select: languageSelect,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(code: string): Promise<Language> {
    const row = await this.prisma.language.findUnique({
      where: { code },
      select: languageSelect,
    });

    if (!row) {
      throw new NotFoundException(`Language ${code} not found`);
    }

    return row;
  }
}
