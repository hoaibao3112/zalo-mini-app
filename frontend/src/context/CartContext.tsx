import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { CartItem, Product } from '../types/models.types';

interface CartState {
  items: CartItem[];
  total: number;
  totalItems: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { cartId: string; quantity: number } }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(
        (i) => i.cartId === action.payload.cartId
      );
      
      let newItems;
      if (existingItemIndex >= 0) {
        newItems = [...state.items];
        newItems[existingItemIndex].quantity += action.payload.quantity;
      } else {
        newItems = [...state.items, action.payload];
      }
      
      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + (item.salePrice || item.price) * item.quantity, 0),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0)
      };
    }
    case 'REMOVE_ITEM': {
      const newItems = state.items.filter((i) => i.cartId !== action.payload);
      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + (item.salePrice || item.price) * item.quantity, 0),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0)
      };
    }
    case 'UPDATE_QUANTITY': {
      const newItems = state.items.map((i) =>
        i.cartId === action.payload.cartId ? { ...i, quantity: action.payload.quantity } : i
      );
      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + (item.salePrice || item.price) * item.quantity, 0),
        totalItems: newItems.reduce((sum, item) => sum + item.quantity, 0)
      };
    }
    case 'CLEAR_CART':
      return { items: [], total: 0, totalItems: 0 };
    default:
      return state;
  }
}

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0, totalItems: 0 });
  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  
  // Provide backward compatibility for existing code that uses addToCart, etc.
  return {
    cartItems: ctx.state.items,
    totalItems: ctx.state.totalItems,
    total: ctx.state.total,
    addToCart: (item: CartItem) => ctx.dispatch({ type: 'ADD_ITEM', payload: item }),
    removeFromCart: (cartId: string) => ctx.dispatch({ type: 'REMOVE_ITEM', payload: cartId }),
    updateQuantity: (cartId: string, quantity: number) => ctx.dispatch({ type: 'UPDATE_QUANTITY', payload: { cartId, quantity } }),
    clearCart: () => ctx.dispatch({ type: 'CLEAR_CART' })
  };
}
