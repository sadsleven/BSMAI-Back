import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SeedService {
  constructor(
    private configService: ConfigService
  ) {
    
  }
  async run() {
   
  }
}

