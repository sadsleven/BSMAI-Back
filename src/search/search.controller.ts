import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  async search(@Query('q') q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.search(q ?? '', user);
  }
}
