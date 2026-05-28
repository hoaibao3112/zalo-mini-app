import React from 'react';
import { Home, ShoppingBag, Store, User, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    path !== '/'
      ? location.pathname.startsWith(path)
      : location.pathname === path;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 h-24 pointer-events-none">
      <div className="relative w-full h-full pointer-events-auto">
        {/* SVG Background - The Hill Shape */}
        <svg
          className="absolute bottom-0 left-0 w-full h-full text-brand-dark fill-current"
          viewBox="0 0 375 100"
          preserveAspectRatio="none"
        >
          <path d="M0,100 L0,50 Q187.5,0 375,50 L375,100 Z" />
        </svg>

        {/* Icons Container */}
        <div className="absolute inset-0 flex justify-between items-end pb-6 px-6">
          {/* Left Group */}
          <div className="flex space-x-8 items-end w-[110px] justify-center">
            <button
              onClick={() => navigate('/cart')}
              className={`p-2 transition-colors duration-300 ${isActive('/cart') ? 'text-brand-primary' : 'text-[#4E5053] hover:text-white'}`}
            >
              <ShoppingBag size={24} strokeWidth={2} />
            </button>
            <button
              onClick={() => navigate('/orders')}
              className={`p-2 transition-colors duration-300 ${isActive('/orders') ? 'text-brand-primary' : 'text-[#4E5053] hover:text-white'}`}
            >
              <FileText size={24} strokeWidth={2} />
            </button>
          </div>

          {/* Right Group */}
          <div className="flex space-x-8 items-end w-[110px] justify-center">
            <button
              onClick={() => navigate('/ecom')}
              className={`p-2 transition-colors duration-300 ${isActive('/ecom') ? 'text-brand-primary' : 'text-[#4E5053] hover:text-white'}`}
            >
              <Store size={24} strokeWidth={2} />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className={`p-2 transition-colors duration-300 ${isActive('/profile') ? 'text-brand-primary' : 'text-[#4E5053] hover:text-white'}`}
            >
              <User size={24} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Floating Center Home Button */}
        <div className="absolute -top-0 left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => navigate('/')}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 bg-brand-primary text-white"
          >
            <Home size={26} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
};