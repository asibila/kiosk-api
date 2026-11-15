import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  parseChips,
  SuggestionsService,
  type Suggestion,
} from './suggestions.service.js';

@Controller('suggest')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  async suggest(
    @Query('q') q = '',
    @Query('lang') lang = 'en',
    @Query('category') category?: string,
    @Query('chips') chips?: string,
    @Query('orientation') orientation?: string,
  ): Promise<{ suggestions: Suggestion[] }> {
    let categoryId: number | undefined;
    if (category !== undefined && category !== '') {
      const parsed = Number(category);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException('category must be a positive integer');
      }
      categoryId = parsed;
    }

    if (orientation !== undefined && orientation !== '' && orientation !== 'buy' && orientation !== 'sell') {
      throw new BadRequestException('orientation must be "buy" or "sell"');
    }

    return this.suggestionsService.suggest({
      q,
      lang,
      categoryId,
      orientation: orientation === 'buy' || orientation === 'sell' ? orientation : undefined,
      chips: parseChips(chips),
    });
  }
}
