import React, { useState, useEffect } from 'react';
import { Search, Plus, Bell, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/layout/BottomNav';
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

  // Các trạng thái tương tác mới
  const [showBarcode, setShowBarcode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

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
    <div className="flex flex-col h-full bg-brand-cream font-sans relative overflow-hidden">
      <PopupModal />

      {/* Header - Sticky at the very top for brand premium identity */}
      <div className="px-6 pt-12 pb-4 flex justify-between items-center z-20 bg-brand-cream sticky top-0 shrink-0 border-b border-brand-coffee/5 shadow-xs">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/profile')}>
           <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-soft shrink-0">
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
             <h2 className="text-[15px] font-extrabold text-brand-dark leading-tight tracking-tight">
               ExpressCafe ☕
             </h2>
             <p className="text-[9px] text-gray-400 font-bold">Thành viên thân thiết</p>
           </div>
        </div>
        
        <span 
           onClick={() => showToast("✨ Quyền lợi Vàng: Bạn được giảm giá 10% tại quầy POS & Freeship đồ uống local!")}
           className="px-3.5 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-extrabold shadow-sm cursor-pointer active:scale-95 transition-all"
        >
           Gold Member
        </span>
      </div>

      {/* Unified Scroll Container for all Page Content */}
      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar space-y-6 pt-4">
         
         {/* Greeting Title */}
         <div className="px-6">
            <h1 className="text-3xl font-extrabold text-brand-dark tracking-tight leading-tight">Chào buổi sáng!</h1>
            <p className="text-xs text-gray-400 mt-1 font-medium">Khám phá hương vị cà phê thượng hạng hôm nay.</p>
         </div>

         {/* Coffee Passport Loyalty Card */}
         <div className="px-6">
            <div className="bg-gradient-to-br from-[#2D1B13] via-[#1C0D07] to-[#110603] rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden border border-white/5">
               <div className="absolute top-0 right-0 w-32 h-32 bg-brand-coffee/10 rounded-full blur-2xl pointer-events-none"></div>
               
               <div className="flex justify-between items-start mb-6">
                  <div>
                     <h3 className="font-extrabold text-lg text-white tracking-wide">Gold Barista Member</h3>
                     <p className="text-[10px] text-white/50 font-mono mt-0.5">Coffee Passport</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                     <span className="text-xl">☕</span>
                  </div>
               </div>

               <div className="flex justify-between items-center mb-5">
                  <div>
                     <p className="text-[26px] font-extrabold text-white tracking-tight leading-none">
                        850 <span className="text-[10px] text-orange-200 font-bold uppercase tracking-wider pl-1">Bean Points</span>
                     </p>
                  </div>
                  
                  <button 
                     onClick={() => setShowBarcode(true)} 
                     className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-2xl text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                     <span className="text-xs">🔳</span>
                     Quét Mã Tích Điểm
                  </button>
               </div>

               {/* Stamp-card milestones progress bar */}
               <div className="space-y-2 border-t border-white/5 pt-4">
                  <div className="flex justify-between text-[10px] font-bold text-white/60">
                     <div className="flex items-center gap-1">
                        <span className="text-orange-300">●</span>
                        <span>5/10 Stamps</span>
                     </div>
                     <span className="cursor-pointer" onClick={() => showToast("🎉 Tích đủ 10 stamps để nhận 1 ly Latte hoàn toàn miễn phí!")}>Còn 150 điểm để lên hạng Diamond</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full w-[60%] bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"></div>
                  </div>
               </div>
            </div>
         </div>

         {/* Fulfillment Toggle Switch */}
         <div className="px-6">
            <div className="bg-brand-gray/60 p-1.5 rounded-[24px] flex border border-gray-100/50">
               <button 
                  onClick={() => {
                     setFulfillment('delivery');
                     showToast('🛵 Đã chuyển sang chế độ Giao Hàng tận nhà!');
                  }}
                  className={`flex-1 py-3 font-extrabold text-xs rounded-xl transition-all duration-300 ${
                     fulfillment === 'delivery' ? 'bg-brand-coffee text-white shadow-sm' : 'text-gray-500'
                  }`}
               >
                  Giao Hàng
               </button>
               <button 
                  onClick={() => {
                     setFulfillment('pickup');
                     showToast('☕ Đã chuyển sang chế độ Tự Đến Lấy tại quầy!');
                  }}
                  className={`flex-1 py-3 font-extrabold text-xs rounded-xl transition-all duration-300 ${
                     fulfillment === 'pickup' ? 'bg-brand-coffee text-white shadow-sm' : 'text-gray-500'
                  }`}
               >
                  Tự Đến Lấy
               </button>
            </div>
         </div>

         {/* Service Category Buttons Grid (Dynamic categories navigation & scrolling) */}
         <div className="px-6">
            <div className="flex justify-between items-center gap-2">
               {categories.map((cat, index) => {
                  const emojis = ['☕', '🥤', '🍦', '🥐', '🍵'];
                  const emoji = emojis[index % emojis.length];
                  const isActive = activeCategory === cat.id;
                  return (
                     <button 
                        key={cat.id}
                        onClick={() => {
                           setActiveCategory(cat.id);
                           showToast(`📂 Đã lọc danh mục: ${cat.name}`);
                           document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
                        }} 
                        className="flex flex-col items-center gap-2 flex-1"
                     >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-soft border transition-all duration-300 active:scale-90 ${
                           isActive ? 'bg-brand-coffee text-white border-brand-coffee shadow-md' : 'bg-white text-brand-dark border-gray-100'
                        }`}>
                           <span className="text-xl">{emoji}</span>
                        </div>
                        <span className={`text-[10px] font-extrabold tracking-wide ${isActive ? 'text-brand-coffee font-black' : 'text-gray-500'}`}>{cat.name}</span>
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Discovery Banners Horizontal Carousel */}
         <div className="space-y-3 pt-2">
            <div className="px-6 flex justify-between items-end">
               <h2 className="text-xs font-black text-brand-coffee uppercase tracking-wider flex items-center gap-1.5">
                  ✨ Khám phá dịch vụ
               </h2>
               <span className="text-[10px] text-gray-400 font-bold animate-pulse">Vuốt trái ➔</span>
            </div>
            
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6 py-2">
               {/* Card 1: Vòng Quay May Mắn */}
               <div 
                  onClick={() => {
                     showToast('🎡 Đang kết nối Vòng Quay May Mắn...');
                     navigate('/game');
                  }}
                  className="w-[280px] h-[150px] bg-gradient-to-br from-[#E25C38] via-[#F48C06] to-[#FFBA08] rounded-[24px] p-5 text-white flex flex-col justify-between shadow-soft border border-orange-500/10 shrink-0 relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer group"
               >
                  <div className="absolute right-0 bottom-0 top-0 w-24 bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
                  <div className="z-10">
                     <span className="px-2 py-0.5 bg-white text-orange-600 text-[8px] font-black rounded-md uppercase tracking-wider shadow-xs animate-pulse">
                        100% Trúng Thưởng 🎡
                     </span>
                     <h3 className="font-extrabold text-[16px] mt-2 leading-tight tracking-tight drop-shadow-xs">Vòng Quay May Mắn</h3>
                     <p className="text-[10px] text-orange-100/90 mt-1 leading-snug font-medium line-clamp-2">
                        Quay trúng Voucher & Quà tặng tự động nạp thẳng vào giỏ hàng!
                     </p>
                  </div>
                  <div className="flex justify-between items-center z-10 pt-2 border-t border-white/10 mt-auto">
                     <span className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Chơi ngay ➔</span>
                     <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/25 text-sm animate-bounce">
                        🎡
                     </div>
                  </div>
               </div>

               {/* Card 2: Gói POS Cafe */}
               <div 
                  onClick={() => {
                     showToast('🚀 Đang mở danh mục gói POS Cafe...');
                     navigate('/express-packages');
                  }}
                  className="w-[280px] h-[150px] bg-gradient-to-br from-[#054E3C] to-[#023126] rounded-[24px] p-5 text-white flex flex-col justify-between shadow-soft border border-emerald-800/10 shrink-0 relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer group"
               >
                  <div className="absolute right-0 bottom-0 top-0 w-24 bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
                  <div className="z-10">
                     <span className="px-2 py-0.5 bg-[#00CE9B] text-white text-[8px] font-black rounded-md uppercase tracking-wider shadow-xs">
                        Mới Nhất 🔥
                     </span>
                     <h3 className="font-extrabold text-[16px] mt-2 leading-tight tracking-tight drop-shadow-xs">Gói POS Cafe</h3>
                     <p className="text-[10px] text-emerald-100/95 mt-1 leading-snug font-medium line-clamp-2">
                        Giải pháp quản lý, bán hàng và vận hành toàn diện cho quán nước.
                     </p>
                  </div>
                  <div className="flex justify-between items-center z-10 pt-2 border-t border-emerald-500/20 mt-auto">
                     <span className="text-[9px] text-emerald-100/80 font-bold uppercase tracking-wider">Xem giải pháp ➔</span>
                     <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/15 text-xs">
                        ▶
                     </div>
                  </div>
               </div>

               {/* Card 3: Gói Ưu Đãi ExpressCafe */}
               <div 
                  onClick={() => {
                     showToast('🎟️ Đang tải các gói Voucher ưu đãi...');
                     navigate('/express-packages');
                  }}
                  className="w-[280px] h-[150px] bg-gradient-to-br from-[#3D251C] to-[#25130E] rounded-[24px] p-5 text-white flex flex-col justify-between shadow-soft border border-amber-900/10 shrink-0 relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer group"
               >
                  <div className="absolute right-0 bottom-0 top-0 w-24 bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
                  <div className="z-10">
                     <span className="px-2 py-0.5 bg-[#C89C76] text-white text-[8px] font-black rounded-md uppercase tracking-wider shadow-xs">
                        Siêu Tiết Kiệm 🎟️
                     </span>
                     <h3 className="font-extrabold text-[16px] mt-2 leading-tight tracking-tight drop-shadow-xs">Mua Gói Ưu Đãi</h3>
                     <p className="text-[10px] text-amber-100/90 mt-1 leading-snug font-medium line-clamp-2">
                        Combo voucher ưu đãi ExpressCafe độc quyền giá siêu hời.
                     </p>
                  </div>
                  <div className="flex justify-between items-center z-10 pt-2 border-t border-amber-500/20 mt-auto">
                     <span className="text-[9px] text-amber-100/80 font-bold uppercase tracking-wider">Mua ngay ➔</span>
                     <button className="px-3 py-1 bg-[#C89C76] text-white font-extrabold text-[8px] rounded-lg shadow-sm group-hover:scale-105 active:scale-95 transition-transform uppercase tracking-wider">
                        Xem
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Products Section */}
         <div id="products-section" className="space-y-4 pt-2">
           {/* Title & See All */}
           <div className="px-6 flex justify-between items-end">
             <h2 className="text-[20px] font-extrabold text-brand-dark leading-none">Sản phẩm nổi bật</h2>
             <button 
                onClick={() => {
                   showToast('🛒 Đang chuyển tới trang tất cả sản phẩm...');
                   navigate('/ecom');
                }}
                className="text-xs font-extrabold text-[#C89C76] active:scale-95 transition-all"
             >
                Xem tất cả
             </button>
           </div>

           {/* Horizontal Category Chips */}
           <div className="px-6">
              <div className="flex overflow-x-auto no-scrollbar space-x-3 pb-2 pt-1 -mx-6 px-6">
                <button
                    onClick={() => {
                       setActiveCategory('');
                       showToast('📂 Hiển thị tất cả sản phẩm');
                    }}
                    className={`shrink-0 px-6 h-10 rounded-full text-xs font-extrabold transition-all duration-300 ${
                      activeCategory === '' 
                        ? 'bg-brand-coffee text-white shadow-md' 
                        : 'bg-white text-gray-400 hover:bg-gray-50 shadow-soft border border-gray-100'
                    }`}
                  >
                    Tất cả
                </button>
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                         setActiveCategory(cat.id);
                         showToast(`📂 Đã chọn: ${cat.name}`);
                      }}
                      className={`shrink-0 px-6 h-10 rounded-full text-xs font-extrabold transition-all duration-300 ${
                        isActive 
                          ? 'bg-brand-coffee text-white shadow-md' 
                          : 'bg-white text-gray-400 hover:bg-gray-50 shadow-soft border border-gray-100'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
           </div>

           {/* Product Grid */}
           <div className="px-6">
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
               {displayProducts.map((product) => {
                  const isEcom = product.id && (String(product.id).startsWith('nh_') || String(product.id).startsWith('hv_'));
                  const isHaravan = product.id && String(product.id).startsWith('hv_');
                  
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                         showToast(`🔍 Mở chi tiết sản phẩm: ${product.name}`);
                         navigate(isEcom ? `/ecom/${isHaravan ? 'haravan' : 'nhanh'}/${String(product.id).replace(/^(nh_|hv_)/, '')}` : `/product/${product.id}`);
                      }}
                      className="bg-white rounded-[28px] p-3 shadow-soft flex flex-col relative cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group border border-gray-100/30"
                    >
                      {/* Image Area - Clean rounded square */}
                      <div className="w-full aspect-square rounded-[22px] overflow-hidden bg-brand-light relative mb-3">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {isEcom ? (
                          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md flex items-center shadow-sm text-[8px] font-extrabold text-white ${
                            isHaravan ? 'bg-purple-600' : 'bg-blue-600'
                          }`}>
                            {isHaravan ? 'HARAVAN' : 'NHANH.VN'}
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center shadow-sm text-[9px] font-bold text-amber-700">
                            ★ 4.8
                          </div>
                        )}
                      </div>

                      <div className="px-1 flex flex-col flex-1">
                        <h3 className="text-brand-dark font-extrabold text-sm leading-tight line-clamp-2 mb-1">{product.name}</h3>
                        <div className="flex-1"></div>
                        
                        <div className="flex justify-between items-end mt-2">
                          <div className="flex flex-col">
                            {product.salePrice ? (
                              <>
                                <span className="text-gray-300 text-[10px] line-through">{product.price.toLocaleString()}đ</span>
                                <span className="text-brand-coffee font-extrabold text-base leading-none">{product.salePrice.toLocaleString()}đ</span>
                              </>
                            ) : (
                              <span className="text-brand-coffee font-extrabold text-base leading-none">{product.price.toLocaleString()}đ</span>
                            )}
                          </div>
                          {/* Add Button */}
                          <button 
                             onClick={(e) => {
                                handleQuickAdd(e, product);
                                showToast(`🎉 Đã thêm món ${product.name} vào giỏ hàng!`);
                             }}
                             className="w-8 h-8 bg-brand-coffee rounded-xl flex items-center justify-center text-white shadow-md active:scale-90 transition-transform"
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
               })}
             </div>
           </div>
         </div>
      </div>

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-6 right-6 bg-brand-dark/95 text-brand-cream px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-50 animate-fade-in border border-brand-coffee/20">
           <span className="text-base">🔔</span>
           <p className="text-xs font-bold leading-tight">{toastMessage}</p>
        </div>
      )}

      {/* Loyalty Stamp Barcode Modal */}
      {showBarcode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-6 animate-fade-in" onClick={() => setShowBarcode(false)}>
           <div className="bg-white rounded-[32px] p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="absolute top-4 right-4">
                 <button onClick={() => setShowBarcode(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <p className="text-xs uppercase font-extrabold text-[#C89C76] tracking-wider mb-1">Thẻ Thành Viên</p>
              <h3 className="font-extrabold text-brand-dark text-lg mb-4">Mã Tích Điểm Gold</h3>
              
              {/* Mock Barcode */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-3">
                 <div className="h-16 w-full bg-[repeating-linear-gradient(90deg,black,black_2px,transparent_2px,transparent_6px)] opacity-90"></div>
                 <p className="font-mono text-xs font-bold text-gray-500 tracking-widest">EC-850-GP99</p>
              </div>
              
              <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                 Đưa mã này cho nhân viên tại quầy POS để tích hạt đậu hoặc thanh toán trừ điểm ví thành viên!
              </p>
              
              <button 
                 onClick={() => setShowBarcode(false)}
                 className="mt-6 w-full py-3 bg-brand-coffee hover:bg-brand-coffee/90 text-white font-extrabold text-xs rounded-2xl shadow-md active:scale-95 transition-all"
              >
                 Đóng
              </button>
           </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};