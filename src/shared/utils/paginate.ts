import { Repository, FindOptionsOrder, FindOptionsWhere, FindOptionsSelect, SelectQueryBuilder } from 'typeorm';
import { PaginatedResponse } from '../interfaces/PaginatedResponse';

export async function paginate<T>(
  repository: Repository<T>,
  page: number = 1,
  limit: number = 10,
  sort?: FindOptionsOrder<T>,
  filter?: FindOptionsWhere<T>,
  relations?: string[],
  select?: FindOptionsSelect<T>
): Promise<PaginatedResponse<T>> {
  const [result, total] = await repository.findAndCount({
    where: filter,
    relations,
    skip: (page - 1) * limit,
    take: limit,
    order: sort,
    select: select
  });

  return {
    data: result,
    metadata: {
      total,
      page,
      lastPage: Math.ceil(total / limit),
    }
  };
}

export async function paginateBuilder<T>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 10,
  customMapper?: (entities: T[], raw: any[]) => T[]
): Promise<PaginatedResponse<T>> {
  const total = await queryBuilder.getCount();

  const result = await queryBuilder
    .offset((page - 1) * limit)
    .limit(limit)
    .getRawAndEntities();

  const data = customMapper ? customMapper(result.entities, result.raw) : result.entities;

  return {
    data,
    metadata: {
      total,
      page,
      lastPage: Math.ceil(total / limit),
    }
  };
}