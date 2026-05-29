import React from 'react';
import { Home, ShoppingBag, Store, User, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();

  const isActive = (path: string) =>
    path !== '/'
      ? location.pathname.startsWith(path)
      : location.pathname === path;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 h-28 pointer-events-none">
      <div className="relative w-full h-full pointer-events-auto flex items-end justify-center">
        {/* White rounded panel with subtle shadow */}
        <div className="absolute left-4 right-4 bottom-2 bg-white rounded-3xl shadow-[0_14px_50px_rgba(16,24,40,0.08)] border border-gray-100/60 h-[86px] flex items-end justify-between px-6 pb-4">
          {/* Left icons */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/cart')}
              aria-label="Giỏ hàng"
              className={`flex flex-col items-center text-[11px] transition-colors duration-200 ${isActive('/cart') ? 'text-brand-primary' : 'text-[#6B6E71]'}`}
            >
              <div className="relative">
                <ShoppingBag size={22} strokeWidth={2} />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#FF6A00] text-white text-[10px] font-black rounded-full px-1.5 py-0.5 shadow-sm">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="mt-1">Giỏ hàng</span>
            </button>

            <button
              onClick={() => navigate('/orders')}
              aria-label="Đơn hàng"
              className={`flex flex-col items-center text-[11px] transition-colors duration-200 ${isActive('/orders') ? 'text-brand-primary' : 'text-[#6B6E71]'}`}
            >
              <FileText size={20} strokeWidth={2} />
              <span className="mt-1">Đơn hàng</span>
            </button>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/ecom')}
              aria-label="Cửa hàng"
              className={`flex flex-col items-center text-[11px] transition-colors duration-200 ${isActive('/ecom') ? 'text-brand-primary' : 'text-[#6B6E71]'}`}
            >
              <Store size={20} strokeWidth={2} />
              <span className="mt-1">Cửa hàng</span>
            </button>

            <button
              onClick={() => navigate('/profile')}
              aria-label="Tài khoản"
              className={`flex flex-col items-center text-[11px] transition-colors duration-200 ${isActive('/profile') ? 'text-brand-primary' : 'text-[#6B6E71]'}`}
            >
              <User size={20} strokeWidth={2} />
              <span className="mt-1">Tài khoản</span>
            </button>
          </div>
        </div>

        {/* Floating center home button - small circular tab */}
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 pointer-events-auto">
          <button
            onClick={() => navigate('/')}
            aria-label="Trang chủ"
            className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95 bg-gradient-to-br from-[#FF8A00] to-[#FF5A00] text-white ring-1 ring-white/80"
          >
            <span className="absolute inset-0 rounded-full opacity-25 blur-[4px] animate-home-glow"></span>
            <Home size={20} fill="currentColor" />
          </button>

          {/* small page indicator dots */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-[#FFD6A6]"></span>
            <span className="w-2 h-2 rounded-full bg-[#FFC08A] opacity-60"></span>
            <span className="w-2 h-2 rounded-full bg-[#FFC08A] opacity-40"></span>
          </div>
        </div>
      </div>
    </div>
  );
};