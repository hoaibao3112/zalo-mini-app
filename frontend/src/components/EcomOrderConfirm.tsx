import React, { useState } from 'react';
import { MapPin, Phone, User, Loader } from 'lucide-react';
import { Sheet, Box, Text, Button, Input } from 'zmp-ui';
import { getPhoneNumber } from 'zmp-sdk/apis';
import type { EcomProduct, EcomShippingAddress } from '../types/ecom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface EcomOrderConfirmProps {
    product: EcomProduct;
    selectedVariantId?: number;
    quantity: number;
    onClose: () => void;
    onSuccess: (orderId: string) => void;
}

export const EcomOrderConfirm: React.FC<EcomOrderConfirmProps> = ({
    product,
    selectedVariantId,
    quantity,
    onClose,
    onSuccess,
}) => {
    const { user } = useAuth();

    const [address, setAddress] = useState<EcomShippingAddress>({
        name: user?.name || '',
        phone: (user as any)?.phone || '',
        address: (user as any)?.address || '',
        city: (user as any)?.city || '',
    });
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Tính giá hiển thị
    const unitPrice = product.salePrice ?? product.price;
    const total = unitPrice * quantity;

    // Lấy tên variant đang chọn (nếu Haravan)
    const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);

    const requestZaloPhone = async () => {
        try {
            await getPhoneNumber({
                success: async (data) => {
                    const { token } = data;
                    // TODO: Call your backend to exchange token for phone number
                    // For now, if zmp-sdk gives plain text or you mock it:
                    console.log('Phone token:', token);
                    // Mock auto-fill for demo purposes:
                    if (data.number) {
                        setAddress(prev => ({ ...prev, phone: data.number! }));
                    }
                },
                fail: (error) => {
                    console.error('Failed to get phone:', error);
                }
            });
        } catch (err) {
            console.error('Zalo API Error', err);
        }
    };

    const handleSubmit = async () => {
        const isLocal = product.platform === 'LOCAL';

        // Validate form — LOCAL không cần địa chỉ
        if (!address.name.trim()) { setError('Vui lòng nhập họ tên người nhận'); return; }
        const cleanPhone = address.phone.replace(/[\s.\-()]/g, '');
        if (!cleanPhone || !/^(\+?84|0)[3-9][0-9]{8}$/.test(cleanPhone)) {
            setError('Số điện thoại không hợp lệ (VD: 0901234567)'); return;
        }
        if (!user?.id) { setError('Vui lòng đăng nhập để đặt hàng'); return; }

        setLoading(true);
        setError(null);
        try {
            const res = await api.createEcomOrder({
                customerId: user.id,
                platform: product.platform,
                externalProductId: product.externalId || 0,
                externalVariantId: selectedVariantId,
                quantity,
                unitPrice: unitPrice,
                shippingAddress: isLocal ? undefined : {
                    ...address,
                    phone: cleanPhone, // gửi số đã clean
                },
                note: note || undefined,
            });

            // api.createEcomOrder trả về data (fetchWithAuth unwrap success.data)
            // nếu có internalOrderId hoặc id → thành công
            const orderId = (res as any)?.internalOrderId || (res as any)?.id || (res as any)?.externalOrderId;
            if (orderId) {
                onSuccess(orderId);
            } else if ((res as any)?.error || (res as any)?.message) {
                setError((res as any).message || (res as any).error || 'Đặt hàng thất bại');
            } else {
                setError('Đặt hàng thất bại. Vui lòng thử lại.');
            }
        } catch (err: any) {
            console.error('[EcomOrderConfirm] Error:', err);
            setError(err?.message || 'Lỗi kết nối. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet
            visible={true}
            onClose={onClose}
            autoHeight
            swipeToClose
        >
            <Box className="px-5 py-4 space-y-4">
                {/* Header */}
                <Text className="text-brand-dark font-bold text-lg text-center mb-2">Xác nhận đặt hàng</Text>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-2xl p-4 flex gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/64x64?text=?'; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <Text className="text-brand-dark font-semibold text-sm line-clamp-2">{product.name}</Text>
                        {selectedVariant && (
                            <Text className="text-gray-400 text-xs mt-0.5">{selectedVariant.title}</Text>
                        )}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-gray-500 text-xs">x{quantity}</span>
                            <span className="text-brand-primary font-bold text-sm">
                                {total.toLocaleString('vi-VN')}đ
                            </span>
                        </div>
                    </div>
                </div>

                {/* Shipping Info */}
                <div className="space-y-3">
                    <Text className="text-brand-dark font-semibold text-sm flex items-center gap-2">
                        <MapPin size={14} className="text-brand-primary" />
                        Thông tin giao hàng
                    </Text>

                    <div className="space-y-2">
                        <Input
                            placeholder="Họ tên người nhận *"
                            value={address.name}
                            onChange={e => setAddress(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-gray-50 rounded-xl"
                        />

                        <div className="flex gap-2">
                            <Input
                                placeholder="Số điện thoại *"
                                type="text"
                                value={address.phone}
                                onChange={e => setAddress(prev => ({ ...prev, phone: e.target.value }))}
                                className="bg-gray-50 rounded-xl flex-1"
                            />
                            <Button
                                onClick={requestZaloPhone}
                                className="bg-brand-primary/10 text-brand-primary shrink-0 rounded-xl px-3"
                            >
                                Điền tự động
                            </Button>
                        </div>

                        <Input
                            placeholder="Địa chỉ cụ thể"
                            value={address.address || ''}
                            onChange={e => setAddress(prev => ({ ...prev, address: e.target.value }))}
                            className="bg-gray-50 rounded-xl"
                        />

                        <Input
                            placeholder="Tỉnh / Thành phố"
                            value={address.city || ''}
                            onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))}
                            className="bg-gray-50 rounded-xl"
                        />

                        <Input.TextArea
                            placeholder="Ghi chú cho đơn hàng..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="bg-gray-50 rounded-xl"
                            maxLength={200}
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <Text className="text-red-600 text-sm">{error}</Text>
                    </div>
                )}

                {/* Total + CTA */}
                <div className="border-t border-gray-100 pt-4 pb-8">
                    <div className="flex justify-between items-center mb-4">
                        <Text className="text-gray-500 text-sm">Tổng thanh toán</Text>
                        <Text className="text-brand-dark font-bold text-lg">
                            {total.toLocaleString('vi-VN')}đ
                        </Text>
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        fullWidth
                        className="py-3.5 bg-brand-primary text-white font-bold rounded-2xl shadow-lg shadow-orange-200/50 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Đang đặt hàng...' : 'Đặt hàng ngay'}
                    </Button>

                    <Text className="text-center text-gray-400 text-[11px] mt-3">
                        Đơn hàng sẽ được gửi tới {product.platform === 'NHANH' ? 'Nhanh.vn' : 'Haravan'}
                    </Text>
                </div>
            </Box>
        </Sheet>
    );
};
