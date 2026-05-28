import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { EcomProduct } from '../types/ecom';

interface EcomProductCardProps {
    product: EcomProduct;
}

const PlatformBadge: React.FC<{ platform: 'NHANH' | 'HARAVAN' }> = ({ platform }) => (
    <span
        className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10 ${platform === 'NHANH'
            ? 'bg-blue-500 text-white'
            : 'bg-purple-500 text-white'
            }`}
    >
        {platform === 'NHANH' ? 'Nhanh.vn' : 'Haravan'}
    </span>
);

export const EcomProductCard: React.FC<EcomProductCardProps> = ({ product }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(`/ecom/${product.platform}/${product.externalId}`, { state: { product } });
    };

    const displayPrice = product.salePrice ?? product.price;
    const hasDiscount = product.salePrice !== undefined && product.salePrice < product.price;

    return (
        <div
            onClick={handleClick}
            className="bg-white rounded-[22px] shadow-sm flex flex-col relative cursor-pointer transition-all hover:shadow-md active:scale-[0.97] overflow-hidden"
        >
            <PlatformBadge platform={product.platform} />

            {/* Product Image */}
            <div className="w-full aspect-square overflow-hidden bg-gray-50">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=No+Image';
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="p-3 flex flex-col gap-1">
                <h3 className="text-brand-dark font-semibold text-sm leading-tight line-clamp-2">
                    {product.name}
                </h3>

                {product.sku && (
                    <p className="text-gray-400 text-[10px]">SKU: {product.sku}</p>
                )}

                <div className="flex items-end justify-between mt-1">
                    <div>
                        {hasDiscount && (
                            <p className="text-gray-400 text-[10px] line-through">
                                {product.price.toLocaleString('vi-VN')}đ
                            </p>
                        )}
                        <p className="text-brand-primary font-bold text-sm">
                            {displayPrice.toLocaleString('vi-VN')}đ
                        </p>
                    </div>

                    {product.inventory !== undefined && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${product.inventory > 0
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-500'
                            }`}>
                            {product.inventory > 0 ? `Còn ${product.inventory}` : 'Hết hàng'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
