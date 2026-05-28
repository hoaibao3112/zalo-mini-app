import React, { useState, useEffect } from 'react';
import { Search, Plus, Bell, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { PopupModal } from '../components/PopupModal';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOmniProducts } from '../hooks/useOmniProducts';
import { useCart } from '../context/CartContext';

interface Category {
  id: string;
  name: string;
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const { products, loading: productsLoading, error: productsError } = useOmniProducts('local');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [loadingCats, setLoadingCats] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
      if (cats.length > 0) {
        setActiveCategory(cats[0].id);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCats(false);
    }
  }

  const displayProducts = activeCategory
    ? products.filter(p => String(p.categoryId) === String(activeCategory)) 
    : products;

  console.log('[DEBUG-HOME] Render:', { 
    total: products.length, 
    activeCat: activeCategory, 
    displayed: displayProducts.length 
  });

  const handleQuickAdd = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    addToCart({
      ...product,
      cartId: `${product.id}-${Date.now()}`,
      quantity: 1,
      size: 'M',
      milkLevel: 50
    });
  };

  if (loadingCats || productsLoading) {
    return (
      <div className="flex flex-col h-full bg-brand-cream items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-gray-200 border-t-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-brand-cream font-sans">
      <PopupModal />

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex justify-between items-center z-10 bg-brand-cream sticky top-0">
        <div className="flex items-center space-x-3">
           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-soft shrink-0">
              <img 
                src={isLoggedIn && user?.avatar ? api.getMediaUrl(user.avatar) : "https://placehold.co/150x150?text=Avatar"} 
                alt="Avatar" 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/150x150?text=Avatar";
                }}
              />
           </div>
           <div>
             <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Chào buổi sáng - V2 FIX</p>
             <h2 className="text-xl font-bold text-brand-dark tracking-tight leading-tight">
               {isLoggedIn && user ? user.name : 'Khách hàng'} 👋
             </h2>
           </div>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => navigate('/game')}
            className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 shadow-soft active:scale-95 transition-transform"
          >
            <Gift size={22} strokeWidth={2} />
          </button>
          
          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-brand-dark shadow-soft active:scale-95 transition-transform">
            <Bell size={22} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Search Bar (Optional depending on design, but good to have) */}
      <div className="px-6 mb-6">
         <div className="bg-white h-14 rounded-[20px] shadow-soft flex items-center px-4 border border-gray-50">
            <Search size={20} className="text-gray-400 mr-3" />
            <input type="text" placeholder="Tìm kiếm thức uống..." className="flex-1 bg-transparent outline-none text-brand-dark placeholder-gray-400 text-base" />
         </div>
      </div>

      {/* Promotion POS Banner */}
      <div className="px-6 mb-6">
          <div 
              onClick={() => navigate('/express-packages')}
              className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-[24px] p-4 text-white flex justify-between items-center shadow-md active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden"
          >
              <div className="z-10">
                  <h3 className="font-extrabold text-base leading-tight">Mua Gói Ưu Đãi ExpressCafe</h3>
                  <p className="text-[11px] text-white/80 mt-1">Mua gói sản phẩm POS, nhận ngay Voucher VIP qua Zalo OA!</p>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl z-10 shrink-0">
                  <Gift size={20} className="text-white animate-bounce" />
              </div>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Horizontal Category Chips */}
        <div className="px-6 mb-4">
           <div className="flex overflow-x-auto no-scrollbar space-x-3 pb-2 pt-1 -mx-6 px-6">
             <button
                 onClick={() => setActiveCategory('')}
                 className={`shrink-0 px-6 h-11 rounded-full text-sm font-semibold transition-all duration-300 ${
                   activeCategory === '' 
                     ? 'bg-brand-dark text-white shadow-md' 
                     : 'bg-white text-gray-500 hover:bg-gray-50 shadow-soft border border-gray-100'
                 }`}
               >
                 Tất cả
             </button>
             {categories.map((cat) => {
               const isActive = activeCategory === cat.id;
               return (
                 <button
                   key={cat.id}
                   onClick={() => setActiveCategory(cat.id)}
                   className={`shrink-0 px-6 h-11 rounded-full text-sm font-semibold transition-all duration-300 ${
                     isActive 
                       ? 'bg-brand-dark text-white shadow-md' 
                       : 'bg-white text-gray-500 hover:bg-gray-50 shadow-soft border border-gray-100'
                   }`}
                 >
                   {cat.name}
                 </button>
               );
             })}
           </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 px-6 overflow-y-auto pb-32 no-scrollbar">
          {productsError && (
             <div className="bg-red-50 p-3 mb-4 rounded-xl border border-red-100 text-[10px] font-mono text-red-600">
               DEBUG ERR: {productsError}
             </div>
          )}

          {products.length === 0 && !productsLoading && (
            <div className="bg-orange-50 p-4 mb-4 rounded-xl border border-orange-100 text-[10px] font-mono text-orange-600">
              Lỗi: Không tìm thấy sản phẩm nào.
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {displayProducts.length === 0 && !productsLoading && products.length > 0 && (
               <div className="col-span-2 text-center py-10 text-gray-400">
                 Không có sản phẩm trong danh mục này.
               </div>
            )}
            {displayProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => navigate(`/product/${product.id}`)}
                className="bg-white rounded-[28px] p-3 shadow-soft flex flex-col relative cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group border border-gray-50/50"
              >
                {/* Image Area - Clean rounded square/rectangle */}
                <div className="w-full aspect-square rounded-[22px] overflow-hidden bg-brand-light relative mb-3">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {/* Rating Badge Overlay */}
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center shadow-sm">
                    <span className="text-yellow-500 text-[10px] mr-1">★</span>
                    <span className="text-[10px] font-bold text-brand-dark">4.8</span>
                  </div>
                </div>

                <div className="px-1 flex flex-col flex-1">
                  <h3 className="text-brand-dark font-bold text-[15px] leading-tight line-clamp-2 mb-1">{product.name}</h3>
                  <div className="flex-1"></div>
                  
                  <div className="flex justify-between items-end mt-2">
                    <div className="flex flex-col">
                      {product.salePrice ? (
                        <>
                          <span className="text-gray-300 text-xs line-through">{product.price.toLocaleString()}đ</span>
                          <span className="text-brand-primary font-bold text-lg leading-none">{product.salePrice.toLocaleString()}đ</span>
                        </>
                      ) : (
                        <span className="text-brand-dark font-bold text-lg leading-none">{product.price.toLocaleString()}đ</span>
                      )}
                    </div>
                    {/* Add Button */}
                    <button 
                       onClick={(e) => handleQuickAdd(e, product)}
                       className="w-10 h-10 bg-brand-primary rounded-[16px] flex items-center justify-center text-white shadow-md active:scale-90 transition-transform"
                    >
                      <Plus size={20} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};