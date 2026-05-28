const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface CursorPaginationParams {
    cursor?: string;
    limit: number;
}

export interface CursorPaginationResult<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
}

export interface OffsetPaginationParams {
    page: number;
    limit: number;
}

export interface OffsetPaginationResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export function parseCursorPagination(query: Record<string, unknown>): CursorPaginationParams {
    const rawLimit = parseInt(query['limit'] as string, 10);
    const limit = isNaN(rawLimit)
        ? DEFAULT_PAGE_SIZE
        : Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);

    const cursor = typeof query['cursor'] === 'string' ? query['cursor'] : undefined;

    return { cursor, limit };
}

export function parseOffsetPagination(query: Record<string, unknown>): OffsetPaginationParams {
    const rawPage = parseInt(query['page'] as string, 10);
    const rawLimit = parseInt(query['limit'] as string, 10);

    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit)
        ? DEFAULT_PAGE_SIZE
        : Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE);

    return { page, limit };
}

export function buildCursorResponse<T extends { id: string }>(
    items: T[],
    limit: number
): CursorPaginationResult<T> {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const lastItem = data[data.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return { data, nextCursor, hasMore, limit };
}

export function buildOffsetResponse<T>(
    data: T[],
    total: number,
    params: OffsetPaginationParams
): OffsetPaginationResult<T> {
    return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
    };
}
