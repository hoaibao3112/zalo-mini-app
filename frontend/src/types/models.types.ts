export interface Category {
  id: string;
  name: string;
  image?: string;
  isActive?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  image: string;
  categoryId: string;
  isActive?: boolean;
}

export interface CartItem extends Product {
  cartId: string;
  quantity: number;
  size?: 'S' | 'M' | 'L';
  milkLevel?: number;
}

export interface User {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
}
