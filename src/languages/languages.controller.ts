import { Controller, Get, Param } from '@nestjs/common';
import { LanguagesService, type Language } from './languages.service.js';

/**
 * Languages are seeded by the database migration (`en` and `hr`); they are
 * exposed read-only because adding one also requires translating every
 * description.
 */
@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  findAll(): Promise<Language[]> {
    return this.languagesService.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string): Promise<Language> {
    return this.languagesService.findOne(code);
  }
}
