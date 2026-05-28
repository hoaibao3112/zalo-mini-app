import React from 'react';
import type { Category } from '../../../types/models.types';

interface CategoryListProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="w-16 bg-brand-primary/90 rounded-tr-[40px] flex flex-col items-center pt-8 pb-24 space-y-12 overflow-y-auto no-scrollbar shadow-lg z-10">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className="relative group h-24 w-full flex items-center justify-center"
          >
            <div
              className={`transform -rotate-90 whitespace-nowrap text-sm transition-all duration-300 ${
                isActive
                  ? 'text-white font-bold text-base'
                  : 'text-white/50 hover:text-white/80 font-medium'
              }`}
            >
              {cat.name}
            </div>
            {/* Active Indicator Dot */}
            {isActive && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
            )}
          </button>
        );
      })}
    </div>
  );
};
