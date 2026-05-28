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
            if (res?.success) {
                setProducts(res.data || []);
            } else {
                setError(res?.error || 'Không thể tải sản phẩm');
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
