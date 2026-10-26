import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../auth/access';
import { id, page, parse } from '../common/core';
import { SearchService } from './search.service';
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}
  @Public() @Get() search(@Query() query: unknown) {
    return this.service.search(
      parse(
        page
          .extend({
            q: z.string().max(200).default(''),
            categoryId: z.coerce.number().int().positive().optional(),
            sellerId: id.optional(),
            minPrice: z.coerce.number().min(0).optional(),
            maxPrice: z.coerce.number().min(0).optional(),
            sort: z
              .enum(['price:asc', 'price:desc', 'ratingAvg:desc', 'sellerRating:desc'])
              .optional(),
          })
          .strict(),
        query,
      ),
    );
  }
}
