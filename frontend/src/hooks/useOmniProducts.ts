import { useState, useEffect } from 'react';
import { OmniProduct } from '../types/omni.types';

import { api } from '../lib/api';

export function useOmniProducts(platform: 'nhanh' | 'haravan' | 'local' = 'nhanh') {
  const [products, setProducts] = useState<OmniProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const source = platform === 'local' ? 'ALL' : platform.toUpperCase();
        console.log(`[DEBUG-FE] Calling api.getEcomProducts with source: ${source}`);
        
        const res = await api.getEcomProducts(source);
        console.log('[DEBUG-FE] Raw Response:', res);

        // Safeguard for different response formats
        let data: any[] = [];
        if (Array.isArray(res)) {
          data = res;
        } else if (res && Array.isArray(res.data)) {
          data = res.data;
        } else {
          console.warn('[DEBUG-FE] Unexpected response format:', res);
          // Nếu backend trả về success: false hoặc error
          if (res && res.message) throw new Error(res.message);
          if (res && res.error) throw new Error(res.error);
        }

        const mappedProducts: OmniProduct[] = data.map((item: any) => ({
          id: item.id || item.externalId || String(Math.random()),
          externalId: item.externalId ? Number(item.externalId) : undefined,
          name: item.name || item.title || 'Sản phẩm',
          price: Number(item.price || 0),
          salePrice: item.salePrice ? Number(item.salePrice) : undefined,
          image: api.getMediaUrl(item.image || ''),
          description: item.description || '',
          platform: item.platform?.toLowerCase() || platform,
          categoryId: item.categoryId 
        }));
        
        console.log('[DEBUG-FE] Total mapped products:', mappedProducts.length);
        
        // MOCK fallback for testing if UI works
        if (mappedProducts.length === 0) {
          console.warn('[DEBUG-FE] API returned 0 products, adding MOCK product');
          setProducts([{
            id: 'mock-local-1',
            name: 'Sản phẩm Test (Nếu thấy món này là FE render OK)',
            price: 55000,
            image: 'https://images.unsplash.com/photo-1541167760496-162955ed2196?w=500',
            platform: 'local'
          }]);
        } else {
          setProducts(mappedProducts);
        }
      } catch (err: any) {
        console.error('[DEBUG-FE] Fetch Error:', err);
        setError(err.message || 'Lỗi không xác định khi tải sản phẩm');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [platform]);

  return { products, loading, error };
}
