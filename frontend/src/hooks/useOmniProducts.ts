import { useState, useEffect } from 'react';
import { OmniProduct } from '../types/omni.types';
import { api } from '../lib/api';

interface EcomApiItem {
  id?: string | number;
  externalId?: string | number;
  name?: string;
  title?: string;
  price?: string | number;
  salePrice?: string | number;
  image?: string;
  description?: string;
  platform?: string;
  categoryId?: string | number;
}

interface EcomApiResponse {
  success?: boolean;
  data?: EcomApiItem[];
  error?: string;
  message?: string;
}

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
        const res: EcomApiResponse | EcomApiItem[] = await api.getEcomProducts(source);

        let data: EcomApiItem[] = [];
        if (Array.isArray(res)) {
          data = res;
        } else if (res && Array.isArray((res as EcomApiResponse).data)) {
          data = (res as EcomApiResponse).data!;
        } else {
          const errRes = res as EcomApiResponse;
          if (errRes?.message) throw new Error(errRes.message);
          if (errRes?.error) throw new Error(errRes.error);
        }

        const mappedProducts: OmniProduct[] = data.map((item) => ({
          id: (item.id ?? item.externalId ?? String(Math.random())) as string,
          externalId: item.externalId ? Number(item.externalId) : undefined,
          name: item.name || item.title || 'Sản phẩm',
          price: Number(item.price || 0),
          salePrice: item.salePrice ? Number(item.salePrice) : undefined,
          image: api.getMediaUrl(item.image || ''),
          description: item.description || '',
          platform: (item.platform?.toLowerCase() as OmniProduct['platform']) || platform,
          categoryId: item.categoryId,
        }));

        setProducts(mappedProducts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định khi tải sản phẩm';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [platform]);

  return { products, loading, error };
}
