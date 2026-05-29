import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { EcomProduct, EcomPlatform } from '../types/ecom';

interface UseEcomProductsOptions {
    source?: EcomPlatform | 'ALL';
    page?: number;
    limit?: number;
    keyword?: string;
}

interface UseEcomProductsReturn {
    products: EcomProduct[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
    hasData: boolean;
}

export function useEcomProducts(options: UseEcomProductsOptions = {}): UseEcomProductsReturn {
    const { source = 'ALL', page = 1, limit = 20, keyword } = options;

    const [products, setProducts] = useState<EcomProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getEcomProducts(source, page, limit, keyword);
            
            // Nếu res là mảng sản phẩm đã unwrap thành công
            if (Array.isArray(res)) {
                setProducts(res);
            } 
            // Nếu res là raw response chứa trường data
            else if (res && Array.isArray(res.data)) {
                setProducts(res.data);
            } 
            // Nếu có lỗi rõ ràng từ response
            else if (res && res.success === false) {
                setError(res.error || res.message || 'Không thể tải sản phẩm');
            } 
            // Lỗi không xác định
            else {
                setError('Không thể tải sản phẩm');
            }
        } catch (err) {
            setError('Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [source, page, limit, keyword]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return {
        products,
        loading,
        error,
        refetch: fetchProducts,
        hasData: products.length > 0,
    };
}
