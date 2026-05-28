export interface OmniProduct {
  id: string | number;
  externalId?: string | number;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  description?: string;
  categoryId?: string | number;
  platform?: 'nhanh' | 'haravan' | 'local';
}

export interface OmniOrder {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{
    productId: string | number;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  platform?: 'nhanh' | 'haravan';
}
