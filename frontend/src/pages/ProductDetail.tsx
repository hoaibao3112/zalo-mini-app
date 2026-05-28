import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOmniProducts } from '../hooks/useOmniProducts';
import { api } from '../lib/api';

const SIZE_OPTIONS = [
  { label: 'Nhỏ', id: 'S' },
  { label: 'Vừa', id: 'M' },
  { label: 'Lớn', id: 'L' },
] as const;

export const ProductDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const { products, loading } = useOmniProducts('local');
  const product = products.find(p => String(p.id) === String(id));

  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<'S'|'M'|'L'>('M');
  const [milkLevel, setMilkLevel] = useState(50);
  const [isFavorite, setIsFavorite] = useState(false);

  if (loading) {
     return (
      <div className="flex flex-col h-full bg-brand-cream items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-gray-200 border-t-brand-primary"></div>
      </div>
    );
  }

  if (!product) {
     return <div className="p-8 text-center mt-20 text-gray-500 font-medium">Không tìm thấy sản phẩm</div>;
  }

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: String(product.id),
      name: product.name,
      description: product.description || '',
      price: product.price,
      salePrice: product.salePrice ?? null,
      image: product.image,
      categoryId: String(product.categoryId || ''),
      cartId: `${product.id}-${Date.now()}`,
      quantity,
      size,
      milkLevel
    };
    addToCart(cartItem);
    navigate('/cart');
  };

  const currentPrice = product.salePrice || product.price;

  return (
    <div className="flex flex-col h-full bg-brand-cream font-sans relative overflow-hidden">
      {/* Immersive Header Image */}
      <div className="relative w-full h-[45%] shrink-0 bg-brand-light">
        {/* Navigation Actions */}
        <div className="absolute top-12 left-6 right-6 flex justify-between items-center z-20">
          <button 
            onClick={() => navigate(-1)}
            className="w-11 h-11 bg-white/80 backdrop-blur-xl rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-colors shadow-sm active:scale-90"
          >
            <ChevronLeft size={24} strokeWidth={2.5} className="-ml-1" />
          </button>
          <button 
            onClick={() => setIsFavorite(!isFavorite)}
            className="w-11 h-11 bg-white/80 backdrop-blur-xl rounded-full flex items-center justify-center transition-colors shadow-sm active:scale-90"
          >
            <Heart size={20} strokeWidth={2.5} className={isFavorite ? "fill-brand-primary text-brand-primary" : "text-brand-dark"} />
          </button>
        </div>

        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover" 
          onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/500x500?text=Mon+Ngon';
          }}
        />
        
        {/* Gradient Fade to Content */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-brand-cream to-transparent"></div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 -mt-6 relative z-10 no-scrollbar">
        {/* Title & Price */}
        <div className="mb-6">
           <div className="flex justify-between items-start mb-2">
              <h1 className="text-2xl font-bold text-brand-dark leading-tight flex-1 pr-4">{product.name}</h1>
              <div className="flex flex-col items-end">
                  {product.salePrice && <span className="text-sm text-gray-400 line-through mb-0.5">{product.price.toLocaleString()}đ</span>}
                  <span className="text-2xl font-extrabold text-brand-primary">{currentPrice.toLocaleString()}đ</span>
              </div>
           </div>
           {product.description && <p className="text-gray-500 text-sm leading-relaxed">{product.description}</p>}
        </div>

        <div className="h-px w-full bg-gray-200 mb-6"></div>

        {/* Segmented Controls - Size */}
        <div className="mb-8">
           <h3 className="text-brand-dark font-bold mb-4">Kích cỡ</h3>
           <div className="flex bg-white rounded-2xl p-1 shadow-soft border border-gray-100 relative">
              {/* Highlight background */}
              <div 
                 className="absolute top-1 bottom-1 bg-brand-dark rounded-xl transition-all duration-300 ease-out"
                 style={{ 
                    width: 'calc(33.333% - 5px)', 
                    left: size === 'S' ? '4px' : size === 'M' ? 'calc(33.333% + 2px)' : 'calc(66.666%)' 
                 }}
              />
              {SIZE_OPTIONS.map((opt) => (
                 <button 
                   key={opt.id}
                   onClick={() => setSize(opt.id as 'S'|'M'|'L')}
                   className={`flex-1 py-3 text-sm font-bold relative z-10 transition-colors duration-300 ${size === opt.id ? 'text-white' : 'text-gray-500'}`}
                 >
                    {opt.label}
                 </button>
              ))}
           </div>
        </div>

        {/* Milk Level Slider */}
        <div className="mb-8">
           <div className="flex justify-between mb-4">
              <h3 className="text-brand-dark font-bold">Lượng sữa</h3>
              <span className="text-brand-primary font-bold">{milkLevel}%</span>
           </div>
           <div className="relative w-full h-2 bg-gray-200 rounded-full">
              <div className="absolute top-0 left-0 h-full bg-brand-primary rounded-full" style={{ width: `${milkLevel}%` }}></div>
              <input 
                 type="range" min="0" max="100" step="25"
                 value={milkLevel} onChange={(e) => setMilkLevel(parseInt(e.target.value))}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {/* Custom Thumb indicator */}
              <div 
                 className="absolute top-1/2 w-6 h-6 bg-white border-2 border-brand-primary rounded-full -translate-y-1/2 -translate-x-1/2 shadow-md pointer-events-none transition-all"
                 style={{ left: `${milkLevel}%` }}
              ></div>
           </div>
           <div className="flex justify-between text-xs font-medium text-gray-400 mt-3 px-1">
              <span>Ít</span>
              <span>Vừa</span>
              <span>Nhiều</span>
           </div>
        </div>
      </div>

      {/* Floating Action Bar (Sticky Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-4 bg-white/80 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30 flex items-center justify-between">
         {/* Quantity */}
         <div className="flex items-center space-x-4 bg-gray-50 px-4 py-3 rounded-[20px] border border-gray-100">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 flex items-center justify-center text-brand-dark hover:bg-gray-200 rounded-full active:scale-90 transition-all"
            >
               <Minus size={18} strokeWidth={2.5} />
            </button>
            <span className="text-lg font-extrabold text-brand-dark w-4 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 flex items-center justify-center text-brand-dark hover:bg-gray-200 rounded-full active:scale-90 transition-all"
            >
               <Plus size={18} strokeWidth={2.5} />
            </button>
         </div>

         {/* Add to Cart Button */}
         <button 
            onClick={handleAddToCart}
            className="flex-1 ml-4 bg-brand-primary text-white py-4 px-6 rounded-[20px] font-bold text-base shadow-float active:scale-95 transition-all flex justify-between items-center"
         >
            <span>Thêm vào giỏ</span>
            <span>{(currentPrice * quantity).toLocaleString()}đ</span>
         </button>
      </div>
    </div>
  );
};