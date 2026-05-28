import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Minus, Plus, Star, Sparkles, Coffee, Info, Check, ShoppingCart, Share2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOmniProducts } from '../hooks/useOmniProducts';
import { api } from '../lib/api';
import type { CartItem } from '../types/models.types';

const SIZE_OPTIONS = [
  { label: 'Nhỏ', id: 'S', volume: '360ml' },
  { label: 'Vừa', id: 'M', volume: '500ml' },
  { label: 'Lớn', id: 'L', volume: '700ml' },
] as const;

const SWEETNESS_OPTIONS = [
  { label: 'Không đường', id: 0 },
  { label: '30%', id: 30 },
  { label: '50%', id: 50 },
  { label: '70%', id: 70 },
  { label: '100%', id: 100 },
] as const;

const TEMP_OPTIONS = [
  { label: 'Uống Đá 🧊', id: 'ice' },
  { label: 'Uống Nóng 🔥', id: 'hot' },
] as const;

export const ProductDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const { products, loading } = useOmniProducts('local');
  const product = products.find(p => String(p.id) === String(id));

  // Tùy chọn trạng thái sản phẩm
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<'S'|'M'|'L'>('M');
  const [milkLevel, setMilkLevel] = useState(50);
  const [sweetness, setSweetness] = useState<number>(50);
  const [temperature, setTemperature] = useState<'ice'|'hot'>('ice');
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Trạng thái thông báo
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Cuộn về đỉnh khi đổi ID sản phẩm
  useEffect(() => {
    setQuantity(1);
    setSize('M');
    setMilkLevel(50);
    setSweetness(50);
    setTemperature('ice');
    setShowSuccessToast(false);
    
    const container = document.getElementById('product-detail-scroll-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [id]);

  // Bộ lọc sản phẩm gợi ý
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    // Ưu tiên sản phẩm cùng categoryId, sau đó điền thêm từ category khác
    const sameCategory = products.filter(p => String(p.id) !== String(id) && p.categoryId === product.categoryId);
    const others = products.filter(p => String(p.id) !== String(id) && p.categoryId !== product.categoryId);
    return [...sameCategory, ...others].slice(0, 5);
  }, [products, id, product?.categoryId]);

  const showToast = (message: string) => {
    setToastMessage(message);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
    return () => clearTimeout(timer);
  };

  if (loading) {
     return (
      <div className="flex flex-col h-full bg-brand-cream items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-gray-200 border-t-brand-primary"></div>
      </div>
    );
  }

  if (!product) {
     return (
       <div className="flex flex-col h-full bg-brand-cream items-center justify-center p-8 text-center">
         <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
           <Info className="text-brand-primary w-8 h-8" />
         </div>
         <p className="text-gray-500 font-bold mb-4">Không tìm thấy sản phẩm hoặc thông tin không tồn tại.</p>
         <button 
           onClick={() => navigate('/')}
           className="px-6 py-3 bg-brand-coffee text-white font-extrabold rounded-2xl text-xs active:scale-95 transition-all shadow-md"
         >
           Quay về Trang chủ
         </button>
       </div>
     );
  }

  const getMilkLabel = (level: number) => {
    if (level === 0) return 'Không sữa';
    if (level <= 25) return 'Ít sữa';
    if (level <= 50) return 'Vừa sữa';
    if (level <= 75) return 'Nhiều sữa';
    return 'Rất nhiều sữa';
  };

  const handleAddToCart = () => {
    const optionDesc = `${getMilkLabel(milkLevel)} | ${sweetness}% Đường | ${temperature === 'ice' ? 'Uống Đá' : 'Uống Nóng'}`;
    const cartItem: CartItem = {
      id: String(product.id),
      name: product.name,
      description: product.description || '',
      price: product.price,
      salePrice: product.salePrice ?? null,
      image: product.image,
      categoryId: String(product.categoryId || ''),
      cartId: `${product.id}-${size}-${milkLevel}-${sweetness}-${temperature}-${Date.now()}`,
      quantity,
      size,
      milkLevel
    };
    
    addToCart(cartItem);
    setShowSuccessToast(true);
  };

  const currentPrice = product.salePrice || product.price;
  const savingAmount = product.salePrice ? (product.price - product.salePrice) : 0;

  return (
    <div className="flex flex-col h-full bg-brand-cream font-sans relative overflow-hidden">
      
      {/* Dynamic Glassmorphism Sticky Header */}
      <div className="absolute top-12 left-6 right-6 flex justify-between items-center z-20">
        <button 
          onClick={() => navigate(-1)}
          className="w-11 h-11 bg-white/75 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-brand-dark hover:bg-white transition-all shadow-md active:scale-90"
        >
          <ChevronLeft size={24} strokeWidth={2.5} className="-ml-0.5 text-brand-coffee" />
        </button>
        
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setIsFavorite(!isFavorite);
              showToast(isFavorite ? "💔 Đã xóa khỏi danh sách yêu thích!" : "❤️ Đã thêm vào danh sách yêu thích!");
            }}
            className="w-11 h-11 bg-white/75 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center transition-all shadow-md active:scale-90"
          >
            <Heart 
              size={20} 
              strokeWidth={2.5} 
              className={isFavorite ? "fill-red-500 text-red-500 scale-110 transition-transform duration-300" : "text-brand-coffee"} 
            />
          </button>
        </div>
      </div>

      {/* SINGLE CONTAINER SCROLLABLE BODY (AVOIDS SCROLL TRAP) */}
      <div 
        className="flex-1 overflow-y-auto no-scrollbar pb-32" 
        id="product-detail-scroll-container"
      >
        {/* Hero Image Section */}
        <div className="relative w-full h-[40vh] shrink-0 bg-brand-light">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover" 
            onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/500x500?text=C%C3%A0+Ph%C3%AA';
            }}
          />
          
          {/* Floating Badges */}
          <div className="absolute bottom-12 left-6 z-10 flex gap-2">
            <span className="px-3.5 py-1.5 bg-amber-500 text-white rounded-full text-[10px] font-extrabold shadow-md flex items-center gap-1 uppercase tracking-wider animate-pulse">
              <Sparkles size={10} className="fill-white" /> Bán chạy nhất 🔥
            </span>
            {product.salePrice && (
              <span className="px-3 py-1 bg-red-500 text-white rounded-full text-[10px] font-extrabold shadow-md flex items-center gap-1 uppercase tracking-wider">
                Giảm {Math.round((1 - product.salePrice / product.price) * 100)}%
              </span>
            )}
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-brand-cream via-brand-cream/40 to-transparent"></div>
        </div>

        {/* Overlapping Content Card */}
        <div className="bg-brand-cream rounded-t-[36px] -mt-8 pt-8 px-6 pb-6 relative z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
          
          {/* Title & Price Information */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              <h1 className="text-2xl font-extrabold text-brand-dark leading-tight tracking-tight mb-2">
                {product.name}
              </h1>
              
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center text-amber-500 bg-amber-50 px-2.5 py-0.5 rounded-lg text-xs font-bold gap-1 border border-amber-100">
                  <Star size={12} className="fill-amber-500 text-amber-500" />
                  <span>4.9</span>
                </div>
                <span className="text-xs text-gray-300 font-bold">•</span>
                <span className="text-xs text-gray-500 font-bold bg-white px-2 py-0.5 rounded-lg border border-gray-100 shadow-xs">Đã bán 120+ ly</span>
                <span className="text-xs text-gray-300 font-bold">•</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg font-extrabold border border-emerald-100">Local Chef ☕</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end shrink-0 pl-2">
              {product.salePrice ? (
                <>
                  <span className="text-xs text-gray-300 line-through font-bold mb-0.5">
                    {product.price.toLocaleString()}đ
                  </span>
                  <span className="text-2xl font-black text-brand-primary leading-none tracking-tight">
                    {product.salePrice.toLocaleString()}đ
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md mt-1 border border-emerald-100">
                    Tiết kiệm {savingAmount.toLocaleString()}đ
                  </span>
                </>
              ) : (
                <span className="text-2xl font-black text-brand-primary leading-none tracking-tight">
                  {product.price.toLocaleString()}đ
                </span>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-gray-200/60 mb-6"></div>

          {/* Interactive Size Option */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-brand-dark font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Coffee size={14} className="text-brand-coffee" /> Chọn kích cỡ
              </h3>
              <span className="text-[10px] text-brand-coffeeLight font-extrabold bg-brand-light px-2.5 py-0.5 rounded-md">Bắt buộc</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {SIZE_OPTIONS.map((opt) => {
                const isActive = size === opt.id;
                return (
                  <button 
                    key={opt.id}
                    onClick={() => {
                      setSize(opt.id);
                      showToast(`📏 Chọn kích cỡ: ${opt.label} (${opt.volume})`);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden ${
                      isActive 
                        ? 'bg-brand-coffee border-brand-coffee text-white shadow-md' 
                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <span className={`text-xl mb-1.5 transition-transform ${isActive ? 'scale-110' : 'opacity-70'}`}>
                      {opt.id === 'S' ? '☕' : opt.id === 'M' ? '🥤' : '🥛'}
                    </span>
                    <span className="text-xs font-extrabold">{opt.label}</span>
                    <span className={`text-[10px] mt-0.5 ${isActive ? 'text-orange-200' : 'text-gray-400'} font-bold`}>
                      {opt.volume}
                    </span>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                        <Check size={8} className="text-white" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Temperature Option (Ice/Hot Toggle) */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-brand-dark font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                🌡️ Chọn nhiệt độ
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {TEMP_OPTIONS.map((opt) => {
                const isActive = temperature === opt.id;
                return (
                  <button 
                    key={opt.id}
                    onClick={() => {
                      setTemperature(opt.id);
                      showToast(`🌡️ Chuyển nhiệt độ: ${opt.label}`);
                    }}
                    className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border-2 transition-all duration-300 active:scale-95 cursor-pointer ${
                      isActive 
                        ? 'bg-brand-coffee border-brand-coffee text-white shadow-md' 
                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xs font-extrabold">{opt.label}</span>
                    {isActive && (
                      <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                        <Check size={8} className="text-white" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Sweetness Option (Sweetness Levels) */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-brand-dark font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                🍬 Chọn mức đường
              </h3>
              <span className="text-xs bg-orange-100 text-brand-primary px-2.5 py-0.5 rounded-full font-extrabold">
                {sweetness}% Đường
              </span>
            </div>
            
            <div className="bg-brand-gray/60 p-1 rounded-2xl flex border border-gray-100/50">
              {SWEETNESS_OPTIONS.map((opt) => {
                const isActive = sweetness === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSweetness(opt.id);
                      showToast(`🍬 Đã chọn mức đường: ${opt.label}`);
                    }}
                    className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-95 ${
                      isActive ? 'bg-brand-coffee text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.id === 0 ? '0%' : `${opt.id}%`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Milk Option Slider */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-brand-dark font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                🥛 Lượng sữa đặc biệt
              </h3>
              <span className="text-xs bg-orange-100 text-brand-primary px-2.5 py-0.5 rounded-full font-extrabold">
                {getMilkLabel(milkLevel)} ({milkLevel}%)
              </span>
            </div>
            
            <div className="relative w-full h-2.5 bg-gray-200 rounded-full mt-4">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-300 to-brand-primary rounded-full transition-all" 
                style={{ width: `${milkLevel}%` }}
              ></div>
              <input 
                type="range" min="0" max="100" step="25"
                value={milkLevel} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMilkLevel(val);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              
              {/* Slider Tick points */}
              {[0, 25, 50, 75, 100].map((tick) => (
                <div 
                  key={tick}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full z-10 -translate-x-1/2"
                  style={{ left: `${tick}%` }}
                ></div>
              ))}
              
              {/* Circular handle */}
              <div 
                className="absolute top-1/2 w-6 h-6 bg-white border-2 border-brand-primary rounded-full -translate-y-1/2 -translate-x-1/2 shadow-md pointer-events-none transition-all duration-100 z-10"
                style={{ left: `${milkLevel}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-2 px-1">
              <span>Không sữa</span>
              <span>Ít sữa</span>
              <span>Vừa đủ</span>
              <span>Nhiều sữa</span>
              <span>Đậm đặc</span>
            </div>
          </div>

          {/* Description Section */}
          <div className="mb-8">
            <h3 className="text-brand-dark font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Info size={14} className="text-brand-coffee" /> Thông tin sản phẩm
            </h3>
            <div className="bg-white rounded-3xl p-4 border border-gray-100/50 shadow-soft">
              <p className="text-gray-500 text-xs leading-relaxed font-bold">
                {product.description || "Hương vị cà phê Robusta và Arabica hảo hạng, được pha chế thủ công tỉ mỉ theo công thức độc quyền của Barista Express. Mang lại cảm giác tỉnh táo tuyệt đối và hậu vị kéo dài dễ chịu."}
              </p>
            </div>
          </div>

          {/* RELATED PRODUCTS SECTION ("Có thể bạn cũng thích") */}
          {relatedProducts.length > 0 && (
            <div className="mb-8 border-t border-gray-200/50 pt-8">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-brand-dark font-extrabold text-sm uppercase tracking-wider flex items-center gap-1.5">
                     <Sparkles size={15} className="text-brand-coffeeLight fill-brand-coffeeGold" /> Có thể bạn cũng thích
                  </h3>
               </div>
               
               <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1">
                  {relatedProducts.map((item) => {
                     const currentItemPrice = item.salePrice || item.price;
                     return (
                        <div 
                          key={item.id}
                          onClick={() => {
                             navigate(`/product/${item.id}`);
                          }}
                          className="w-36 bg-white rounded-3xl p-3 border border-gray-100/80 shadow-soft shrink-0 cursor-pointer active:scale-[0.97] transition-all flex flex-col group relative"
                        >
                           {/* Image */}
                           <div className="w-full aspect-square rounded-[20px] overflow-hidden bg-brand-light relative mb-2.5">
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/150x150?text=Mon+Ngon'; }}
                              />
                              {item.salePrice && (
                                 <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 text-white rounded-md text-[8px] font-extrabold shadow-sm">
                                    SALE
                                 </span>
                              )}
                           </div>
                           
                           {/* Name */}
                           <h4 className="text-[11px] font-extrabold text-brand-dark line-clamp-2 leading-snug flex-1 mb-2">
                              {item.name}
                           </h4>
                           
                           {/* Pricing & Add */}
                           <div className="flex justify-between items-center mt-auto">
                              <span className="text-xs font-black text-brand-coffee">
                                 {currentItemPrice.toLocaleString()}đ
                              </span>
                              <button 
                                onClick={(e) => {
                                   e.stopPropagation();
                                   const cartItem = {
                                     id: String(item.id),
                                     name: item.name,
                                     description: item.description || '',
                                     price: item.price,
                                     salePrice: item.salePrice ?? null,
                                     image: item.image,
                                     categoryId: String(item.categoryId || ''),
                                     cartId: `${item.id}-M-50-50-ice-${Date.now()}`,
                                     quantity: 1,
                                     size: 'M' as const,
                                     milkLevel: 50
                                   };
                                   addToCart(cartItem);
                                   showToast(`🎉 Thêm thành công ly ${item.name}!`);
                                }}
                                className="w-6.5 h-6.5 bg-brand-coffee hover:bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-md active:scale-85 transition-all shrink-0"
                              >
                                 <Plus size={13} strokeWidth={3} />
                              </button>
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
          )}

        </div>
      </div>

      {/* Dynamic Floating Action Bar (Sticky Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-4 bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] z-30 flex items-center justify-between">
         
         {/* Circular Quantity Selector */}
         <div className="flex items-center space-x-4 bg-gray-50 px-4 py-3.5 rounded-[22px] border border-gray-100">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 flex items-center justify-center text-brand-dark hover:bg-gray-200 rounded-full active:scale-80 transition-all bg-white border border-gray-100 shadow-sm"
            >
               <Minus size={16} strokeWidth={2.5} />
            </button>
            <span className="text-lg font-black text-brand-dark w-4 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 flex items-center justify-center text-brand-dark hover:bg-gray-200 rounded-full active:scale-80 transition-all bg-white border border-gray-100 shadow-sm"
            >
               <Plus size={16} strokeWidth={2.5} />
            </button>
         </div>

         {/* Call to action (Add to Cart button with price) */}
         <button 
            onClick={handleAddToCart}
            className="flex-1 ml-4 bg-brand-primary text-white py-4 px-6 rounded-[22px] font-black text-sm shadow-float active:scale-[0.96] transition-all flex justify-between items-center relative overflow-hidden group"
         >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <span>THÊM VÀO GIỎ HÀNG</span>
            <span className="font-extrabold bg-white/15 px-3 py-1 rounded-xl">{(currentPrice * quantity).toLocaleString()}đ</span>
         </button>
      </div>

      {/* Standard simple toast */}
      {toastMessage && (
        <div className="fixed bottom-28 left-6 right-6 bg-brand-dark/95 text-brand-cream px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-50 animate-fade-in border border-brand-coffee/20">
           <span className="text-base">🔔</span>
           <p className="text-xs font-bold leading-tight">{toastMessage}</p>
        </div>
      )}

      {/* Premium Product Add Toast Popup Modal */}
      {showSuccessToast && (
        <div className="fixed inset-x-6 bottom-28 bg-brand-dark/95 backdrop-blur-md text-brand-cream p-5 rounded-3xl shadow-2xl flex flex-col gap-4 z-50 animate-fade-in border border-brand-coffee/20">
           <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-md">
                 🎉
              </div>
              <div className="min-w-0 flex-1">
                 <h4 className="text-sm font-extrabold text-white">Đã thêm vào giỏ hàng!</h4>
                 <p className="text-[11px] text-gray-300 mt-1 leading-snug truncate">
                    Món: <span className="font-extrabold text-orange-200">{product.name}</span>
                 </p>
                 <p className="text-[9px] text-gray-400 mt-0.5">
                    Size {size} • {getMilkLabel(milkLevel)} • {sweetness}% Đường • {temperature === 'ice' ? 'Uống Đá 🧊' : 'Uống Nóng 🔥'}
                 </p>
              </div>
           </div>
           
           <div className="flex gap-2">
              <button 
                onClick={() => {
                   setShowSuccessToast(false);
                }}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-extrabold border border-white/10 active:scale-95 transition-all"
              >
                 Chọn tiếp
              </button>
              <button 
                onClick={() => {
                   setShowSuccessToast(false);
                   navigate('/cart');
                }}
                className="flex-1 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-extrabold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                 <ShoppingCart size={13} strokeWidth={2.5} /> Vào giỏ hàng
              </button>
           </div>
        </div>
      )}

    </div>
  );
};