import { Request } from 'express';
import { Customer } from '@prisma/client';

/**
 * Interface mở rộng từ Express Request để định nghĩa các thuộc tính tùy biến của hệ thống
 */
export interface MiniappRequest extends Request {
    workspaceId?: string;       // Tenant ID được middleware resolveTenant tự động điền
    customer?: Customer;        // Customer CRM Record được middleware verifyCustomerOwnership điền
    correlationId?: string;     // correlationId được gán vào request để bám vết logger
    zaloId?: string;            // zaloId lấy từ verified Zalo Access Token
}
