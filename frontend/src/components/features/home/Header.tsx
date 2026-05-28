import React from 'react';
import { Search, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../../types/models.types';

interface HeaderProps {
  user: User | null;
  isLoggedIn: boolean;
}

export const HomeHeader: React.FC<HeaderProps> = ({ user, isLoggedIn }) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="px-6 pt-12 pb-4 flex justify-between items-center z-10">
        <button
          onClick={() => navigate('/game')}
          className="p-2 text-brand-primary"
        >
          <Gift size={24} />
        </button>
        <h1 className="text-xl font-bold text-brand-dark">Aizen</h1>
        <button className="p-2 text-brand-dark relative">
          <Search size={24} />
        </button>
      </div>

      <div className="px-8 mb-6 z-10">
        <p className="text-brand-gray text-base font-normal">Xin chào,</p>
        <h2 className="text-2xl font-bold text-brand-dark mt-1">
          {isLoggedIn && user ? user.name : 'Khách hàng'}
        </h2>
      </div>
    </>
  );
};
