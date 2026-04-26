import { paginateBuilder } from './paginate';
import { SelectQueryBuilder } from 'typeorm';

interface FakeUser {
  id: string;
  roles: string[];
}

function makeMockQB<T extends object>(opts: {
  totalDistinct: number;
  pageHydration: (skip: number, take: number) => T[];
}): SelectQueryBuilder<T> {
  let _take = 0;
  let _skip = 0;
  const qb = {
    take(n: number) {
      _take = n;
      return this;
    },
    skip(n: number) {
      _skip = n;
      return this;
    },
    async getManyAndCount(): Promise<[T[], number]> {
      return [opts.pageHydration(_skip, _take), opts.totalDistinct];
    },
    async getCount(): Promise<number> {
      return opts.totalDistinct;
    },
    async getRawAndEntities(): Promise<{ raw: unknown[]; entities: T[] }> {
      return { raw: [], entities: opts.pageHydration(_skip, _take) };
    },
  };
  return qb as unknown as SelectQueryBuilder<T>;
}

describe('paginateBuilder', () => {
  it('returns hydrated entities and total = distinct root count, not JOIN-row count', async () => {
    const distinctUsers: FakeUser[] = Array.from({ length: 25 }, (_, i) => ({
      id: `u${i}`,
      roles: ['admin', 'editor'],
    }));

    const qb = makeMockQB<FakeUser>({
      totalDistinct: distinctUsers.length,
      pageHydration: (skip, take) => distinctUsers.slice(skip, skip + take),
    });

    const result = await paginateBuilder(qb, 1, 10);

    expect(result.metadata.total).toBe(25);
    expect(result.metadata.lastPage).toBe(3);
    expect(result.metadata.page).toBe(1);
    expect(result.data).toHaveLength(10);
    for (const u of result.data) {
      expect(u.roles).toHaveLength(2);
    }
  });

  it('clamps invalid page/limit', async () => {
    const qb = makeMockQB<FakeUser>({
      totalDistinct: 0,
      pageHydration: () => [],
    });
    const result = await paginateBuilder(qb, 0, 0);
    expect(result.metadata.page).toBe(1);
    expect(result.metadata.lastPage).toBe(1);
  });
});
