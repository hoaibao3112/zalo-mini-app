/**
 * Định nghĩa cấu trúc chuẩn hóa cho phản hồi API hệ thống
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    correlationId?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        hasMore?: boolean;
    };
}

export const successResponse = <T>(data: T, message?: string): ApiResponse<T> => {
    return {
        success: true,
        data,
        ...(message && { message })
    };
};

export const errorResponse = (error: string, message?: string, correlationId?: string): ApiResponse => {
    return {
        success: false,
        error,
        ...(message && { message }),
        ...(correlationId && { correlationId })
    };
};

export const paginatedResponse = <T>(
    data: T[],
    total: number,
    page: number,
    limit: number
): ApiResponse<T[]> => {
    const hasMore = page * limit < total;
    return {
        success: true,
        data,
        meta: {
            page,
            limit,
            total,
            hasMore
        }
    };
};
