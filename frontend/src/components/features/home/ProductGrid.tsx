import React from 'react';
import { Star, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../../types/models.types';

interface ProductGridProps {
  products: Product[];
  onAddToCart?: (product: Product) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart }) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 px-5 overflow-y-auto pb-32 pt-2 no-scrollbar">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
            className="bg-white rounded-[25px] p-3 shadow-sm flex flex-col relative group cursor-pointer transition-all hover:shadow-md active:scale-95"
          >
            {/* Image - Circular and floating slightly */}
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-md -mt-4 border-2 border-white">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-3 px-1">
              <h3 className="text-brand-dark font-bold text-lg leading-tight truncate">
                {product.name}
              </h3>
              <p className="text-brand-gray text-xs mt-1 truncate">
                {product.description}
              </p>

              <div className="flex justify-between items-center mt-3">
                {product.salePrice ? (
                  <div>
                    <p className="text-brand-gray text-xs line-through">
                      {product.price.toLocaleString()}đ
                    </p>
                    <p className="text-brand-dark font-bold text-base">
                      <span className="text-brand-primary">
                        {product.salePrice.toLocaleString()}
                      </span>
                      đ
                    </p>
                  </div>
                ) : (
                  <p className="text-brand-dark font-bold text-base">
                    <span className="text-brand-primary">
                      {product.price.toLocaleString()}
                    </span>
                    đ
                  </p>
                )}
                {/* Add Button - Orange Square */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent navigating to detail
                    if (onAddToCart) onAddToCart(product);
                  }}
                  className="w-8 h-8 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg hover:bg-orange-600 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex items-center text-[10px] text-brand-dark font-bold mt-2">
                <Star
                  size={10}
                  className="text-brand-primary fill-brand-primary mr-1"
                />
                <span>4.8</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
