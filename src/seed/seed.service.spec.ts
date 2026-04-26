import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

describe('SeedService', () => {
  let service: SeedService;

  beforeEach(async () => {
    const repoMock = () => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      restore: jest.fn(),
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getRepositoryToken(Permission), useFactory: repoMock },
        { provide: getRepositoryToken(Role), useFactory: repoMock },
        { provide: getRepositoryToken(User), useFactory: repoMock },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
