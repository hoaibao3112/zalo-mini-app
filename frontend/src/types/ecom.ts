/**
 * Unified E-commerce Types — Mini App side
 * Tương ứng với backend/src/types/ecom.types.ts
 */

export type EcomPlatform = 'NHANH' | 'HARAVAN';

export interface EcomVariant {
    id: number;
    title: string;
    price: number;
    sku: string;
    inventory_quantity: number;
}

export interface EcomProduct {
    id: string; // 'nh_123' hoặc 'hv_456'
    externalId: number;
    platform: EcomPlatform;
    name: string;
    price: number;
    salePrice?: number;
    image: string;
    description?: string;
    sku?: string;
    variants?: EcomVariant[];
    inventory?: number;
}

export interface EcomShippingAddress {
    name: string;
    phone: string;
    address?: string;
    city?: string;
    district?: string;
    ward?: string;
}

export interface EcomCreateOrderPayload {
    customerId: string;
    platform: EcomPlatform;
    externalProductId: number;
    externalVariantId?: number;
    quantity: number;
    shippingAddress: EcomShippingAddress;
    note?: string;
}

export interface EcomOrderResult {
    success: boolean;
    platform: EcomPlatform;
    externalOrderId?: string | number;
    internalOrderId?: string;
    message?: string;
}

export interface EcomProductListResponse {
    success: boolean;
    platform?: EcomPlatform | 'ALL';
    data: EcomProduct[];
    total?: number;
    page?: number;
}
