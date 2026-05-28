import React from 'react';
import { Search, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';

export const Favorites: React.FC = () => {
  const navigate = useNavigate();
  // TODO: Fetch real favorites from backend
  const favoriteProducts: any[] = [];

  return (
    <div className="flex flex-col h-full bg-brand-cream">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 z-10 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-brand-dark">Yêu Thích</h1>
        <button className="p-2 text-brand-dark bg-white rounded-full shadow-sm">
          <Search size={20} />
        </button>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
        {favoriteProducts.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400">
             <Heart size={48} className="mb-4 opacity-20" />
             <p>Chưa có sản phẩm yêu thích nào.</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-4">
            {favoriteProducts.map((product) => (
              <div 
                key={product.id} 
                onClick={() => navigate(`/product/${product.id}`)}
                className="bg-white rounded-[25px] p-3 shadow-sm flex flex-col relative group cursor-pointer transition-all hover:shadow-md active:scale-95"
              >
                {/* Image */}
                <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-md -mt-8 border-4 border-brand-cream">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>

                <div className="mt-3 px-1">
                    <h3 className="text-brand-dark font-bold text-lg leading-tight truncate">{product.name}</h3>
                    <p className="text-brand-gray text-xs mt-1 truncate">{product.description}</p>
                    
                    <div className="flex justify-between items-center mt-3">
                        <p className="text-brand-dark font-bold text-base"><span className="text-brand-primary">$</span>{product.price.toFixed(2)}</p>
                        {/* Heart Button (Active) */}
                        <button className="w-8 h-8 bg-pink-50 rounded-xl flex items-center justify-center text-red-500 shadow-sm">
                            <Heart size={16} fill="currentColor" />
                        </button>
                    </div>
                    
                    <div className="flex items-center text-[10px] text-brand-dark font-bold mt-2">
                        <Star size={10} className="text-brand-primary fill-brand-primary mr-1" />
                        <span>{product.rating}</span>
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};