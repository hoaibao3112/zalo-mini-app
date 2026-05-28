import React, { useState } from 'react';
import { Page, Header, Box, Button, Text } from 'zmp-ui';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, CheckCircle } from 'lucide-react';
import { EcomOrderConfirm } from '../components/EcomOrderConfirm';
import type { EcomProduct, EcomVariant } from '../types/ecom';

export const EcomProductDetail: React.FC = () => {
    const { platform, id } = useParams<{ platform: string; id: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    // Product được truyền qua navigation state từ EcomProductCard
    const product = location.state?.product as EcomProduct | undefined;

    const [quantity, setQuantity] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState<EcomVariant | undefined>(
        product?.variants?.[0]
    );
    const [showConfirm, setShowConfirm] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [orderId, setOrderId] = useState('');

    if (!product) {
        return (
            <Page className="flex flex-col h-full bg-brand-cream items-center justify-center gap-4">
                <Header title="Lỗi" />
                <Text className="text-gray-500">Không tìm thấy sản phẩm</Text>
                <Button
                    onClick={() => navigate('/ecom')}
                    className="bg-brand-primary text-white rounded-xl"
                >
                    Quay lại cửa hàng
                </Button>
            </Page>
        );
    }

    const displayPrice = selectedVariant?.price ?? (product.salePrice ?? product.price);
    const hasDiscount = product.salePrice !== undefined && product.salePrice < product.price;

    const handleSuccess = (newOrderId: string) => {
        setShowConfirm(false);
        setOrderId(newOrderId);
        setOrderSuccess(true);
    };

    if (orderSuccess) {
        return (
            <Page className="flex flex-col h-full bg-brand-cream items-center justify-center px-8 gap-5">
                <Header title="Đặt hàng thành công" showBackIcon={false} />
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mt-12">
                    <CheckCircle size={40} className="text-green-500" />
                </div>
                <div className="text-center">
                    <Text className="text-brand-dark font-bold text-xl mb-2">Đặt hàng thành công!</Text>
                    <Text className="text-gray-500 text-sm">
                        Đơn hàng của bạn đã được gửi tới {product.platform === 'NHANH' ? 'Nhanh.vn' : 'Haravan'}.
                    </Text>
                    {orderId && (
                        <Text className="text-gray-400 text-xs mt-2">Mã đơn: #{orderId.slice(-8)}</Text>
                    )}
                </div>
                <div className="flex gap-3 w-full mt-4">
                    <Button
                        variant="secondary"
                        onClick={() => navigate('/ecom')}
                        className="flex-1 border border-brand-primary text-brand-primary rounded-2xl"
                    >
                        Tiếp tục mua
                    </Button>
                    <Button
                        onClick={() => navigate('/orders')}
                        className="flex-1 bg-brand-primary text-white rounded-2xl shadow-lg shadow-orange-200/50"
                    >
                        Xem đơn hàng
                    </Button>
                </div>
            </Page>
        );
    }

    return (
        <Page className="flex flex-col h-full bg-brand-soft font-sans relative">
            <Header title={product.name} />

            <Box className="flex-1 overflow-y-auto no-scrollbar pb-32">
                {/* Header Image */}
                <div className="w-full aspect-square relative shrink-0">
                    {/* Platform Badge */}
                    <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold text-white z-10 ${product.platform === 'NHANH' ? 'bg-blue-500/80' : 'bg-purple-500/80'} backdrop-blur-sm`}>
                        {product.platform === 'NHANH' ? 'Nhanh.vn' : 'Haravan'}
                    </span>

                    {product.image ? (
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=No+Image'; }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <ShoppingCart size={40} className="text-gray-300" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="bg-brand-soft flex flex-col">
                    <div className="px-6 pt-5 pb-4 flex flex-col gap-4">
                        {/* Name & Price */}
                        <div>
                            <Text className="text-brand-dark font-bold text-xl leading-snug">{product.name}</Text>
                            {product.sku && (
                                <Text className="text-gray-400 text-xs mt-1">SKU: {product.sku}</Text>
                            )}
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-brand-primary font-bold text-2xl">
                                    {displayPrice.toLocaleString('vi-VN')}đ
                                </span>
                                {hasDiscount && !selectedVariant && (
                                    <span className="text-gray-400 text-sm line-through">
                                        {product.price.toLocaleString('vi-VN')}đ
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Variants (Haravan) */}
                        {product.variants && product.variants.length > 1 && (
                            <div>
                                <Text className="text-brand-dark font-semibold text-sm mb-2">Lựa chọn biến thể</Text>
                                <div className="flex flex-wrap gap-2">
                                    {product.variants.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVariant(v)}
                                            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${selectedVariant?.id === v.id
                                                ? 'bg-brand-primary text-white border-brand-primary shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200'
                                                }`}
                                        >
                                            {v.title}
                                            <span className="ml-1 text-xs opacity-70">
                                                {Number(v.price).toLocaleString('vi-VN')}đ
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stock */}
                        {product.inventory !== undefined && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${product.inventory > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                <div className={`w-2 h-2 rounded-full ${product.inventory > 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                                {product.inventory > 0 ? `Còn ${product.inventory} sản phẩm` : 'Tạm hết hàng'}
                            </div>
                        )}

                        {/* Description */}
                        {product.description && (
                            <div>
                                <Text className="text-brand-dark font-semibold text-sm mb-1">Mô tả</Text>
                                <Text className="text-gray-500 text-sm leading-relaxed">{product.description}</Text>
                            </div>
                        )}

                        {/* Quantity */}
                        <div>
                            <Text className="text-brand-dark font-semibold text-sm mb-3">Số lượng</Text>
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-brand-dark hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                >
                                    <Minus size={16} strokeWidth={2} />
                                </button>
                                <span className="text-2xl font-bold text-brand-dark w-6 text-center">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(q => q + 1)}
                                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-brand-dark hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                                >
                                    <Plus size={16} strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Box>

            {/* CTA Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pb-8 pt-3 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-500 text-sm">Tổng</span>
                    <span className="text-brand-dark font-bold text-lg">
                        {(displayPrice * quantity).toLocaleString('vi-VN')}đ
                    </span>
                </div>
                <Button
                    fullWidth
                    onClick={() => setShowConfirm(true)}
                    disabled={product.inventory === 0}
                    className="py-3.5 bg-brand-primary text-white font-bold rounded-2xl shadow-lg shadow-orange-200/50"
                >
                    {product.inventory === 0 ? 'Hết hàng' : 'Đặt hàng ngay'}
                </Button>
            </div>

            {/* Order Confirm Sheet */}
            {showConfirm && (
                <EcomOrderConfirm
                    product={product}
                    selectedVariantId={selectedVariant?.id}
                    quantity={quantity}
                    onClose={() => setShowConfirm(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </Page>
    );
};
