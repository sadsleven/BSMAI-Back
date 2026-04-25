export interface PaginatedResponse<T> {
    data: T[];
    metadata: {
        total: number;
        page: number;
        lastPage: number;
    }
}