import {
  ObjectLiteral,
  Repository,
  FindOptionsOrder,
  FindOptionsWhere,
  FindOptionsSelect,
  SelectQueryBuilder,
} from 'typeorm';
import { PaginatedResponse } from '../interfaces/PaginatedResponse';

export async function paginate<T>(
  repository: Repository<T>,
  page: number = 1,
  limit: number = 10,
  sort?: FindOptionsOrder<T>,
  filter?: FindOptionsWhere<T>,
  relations?: string[],
  select?: FindOptionsSelect<T>,
): Promise<PaginatedResponse<T>> {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(1, limit);
  const [result, total] = await repository.findAndCount({
    where: filter,
    relations,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    order: sort,
    select,
  });

  return {
    data: result,
    metadata: {
      total,
      page: safePage,
      lastPage: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Paginate a SelectQueryBuilder safely across joined relations.
 *
 * Uses `take`/`skip` (not `limit`/`offset`) so TypeORM splits the query into:
 *   1) a paginated query against root-entity IDs (no JOIN cartesian product)
 *   2) a hydration query that loads relations for those IDs
 * This guarantees that paginating a list of users with N roles each does NOT
 * lose users or drop roles, and `total` always counts distinct root entities.
 *
 * Sorting is also applied via `take`/`skip`, so always order by columns of
 * the root entity (e.g. `user.email`), never by columns of a to-many relation,
 * because that ordering is ambiguous after grouping.
 */
export async function paginateBuilder<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 10,
  customMapper?: (entities: T[], raw: unknown[]) => T[],
): Promise<PaginatedResponse<T>> {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(1, limit);

  queryBuilder.take(safeLimit).skip((safePage - 1) * safeLimit);

  if (customMapper) {
    const result = await queryBuilder.getRawAndEntities();
    const total = await queryBuilder.getCount();
    return {
      data: customMapper(result.entities, result.raw as unknown[]),
      metadata: {
        total,
        page: safePage,
        lastPage: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  const [entities, total] = await queryBuilder.getManyAndCount();
  return {
    data: entities,
    metadata: {
      total,
      page: safePage,
      lastPage: Math.ceil(total / safeLimit) || 1,
    },
  };
}
