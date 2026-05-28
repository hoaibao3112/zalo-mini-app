import React from 'react';
import { Home, ShoppingBag, Heart, User, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { icon: <Home size={22} strokeWidth={2.5} />, path: '/', label: 'Trang chủ' },
    { icon: <ShoppingBag size={22} strokeWidth={2.5} />, path: '/cart', label: 'Giỏ hàng' },
    { icon: <FileText size={22} strokeWidth={2.5} />, path: '/orders', label: 'Đơn hàng' },
    { icon: <Heart size={22} strokeWidth={2.5} />, path: '/favorites', label: 'Yêu thích' },
    { icon: <User size={22} strokeWidth={2.5} />, path: '/profile', label: 'Hồ sơ' },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm z-50 pointer-events-none">
      <div className="pointer-events-auto bg-white/70 backdrop-blur-xl rounded-[28px] p-2 flex justify-between items-center shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/40">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-[20px] transition-all duration-400 ease-out active:scale-95 ${
                active ? 'bg-brand-primary shadow-md shadow-orange-500/30 text-white' : 'text-gray-400 hover:text-gray-700 bg-transparent'
              }`}
            >
              <div className={`transition-transform duration-300 ${active ? '-translate-y-0.5' : 'translate-y-0'}`}>
                 {item.icon}
              </div>
              {/* Active Indicator Dot */}
              {active && (
                <div className="absolute bottom-2 w-1.5 h-1.5 bg-white rounded-full opacity-90 animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};