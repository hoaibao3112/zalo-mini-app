import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ShoppingBag, CheckCircle2, AlertCircle, Sparkles, Minus, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, Package } from '../lib/api';

export const ExpressPackagesPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // States cho popup xác nhận
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [pendingPackage, setPendingPackage] = useState<Package | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [purchaseNote, setPurchaseNote] = useState('');
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseError, setPurchaseError] = useState<string | null>(null);
    
    // Idempotency Key
    const idempotencyKeyRef = useRef<string>('');

    // States cho popup thành công
    const [successOrder, setSuccessOrder] = useState<{ orderId: string; message: string } | null>(null);

    useEffect(() => {
        loadPackages();
    }, []);

    // Xử lý sau khi login xong từ handleOpenPurchase
    useEffect(() => {
        if (user && pendingPackage) {
            const pkg = pendingPackage;
            setPendingPackage(null);
            
            idempotencyKeyRef.current = `${user.id}-${pkg.id}-${Date.now()}`;
            setSelectedPackage(pkg);
            setQuantity(1);
            setPurchaseNote('');
            setPurchaseError(null);
            setPurchasing(false);
        }
    }, [user, pendingPackage]);

    const loadPackages = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getExpressPackages();
            if (res && Array.isArray(res.packages)) {
                setPackages(res.packages);
            } else {
                setPackages([]);
            }
        } catch (err: any) {
            console.error('Lỗi tải danh sách gói hàng:', err);
            setError('Không thể kết nối đến máy chủ POS. Vui lòng tải lại trang.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPurchase = async (pkg: Package) => {
        // Nếu chưa login, thực hiện login rồi lưu pkg vào pending
        if (!user) {
            setPendingPackage(pkg);
            await login();
            return;
        }
        
        // Sinh Idempotency Key duy nhất một lần khi mở popup
        idempotencyKeyRef.current = `${user.id}-${pkg.id}-${Date.now()}`;
        
        setSelectedPackage(pkg);
        setQuantity(1);
        setPurchaseNote('');
        setPurchaseError(null);
        setPurchasing(false);
    };

    const handleCloseConfirm = () => {
        if (purchasing) return; // Không cho phép đóng khi đang xử lý thanh toán
        setSelectedPackage(null);
    };

    const handleUpdateQuantity = (delta: number) => {
        setQuantity(prev => {
            const newVal = prev + delta;
            if (newVal < 1) return 1;
            if (newVal > 20) return 20; // Giới hạn tối đa 20 gói
            return newVal;
        });
    };

    const handleConfirmPurchase = async () => {
        if (!user || !selectedPackage) return;

        setPurchasing(true);
        setPurchaseError(null);

        try {
            const res = await api.purchasePackage(idempotencyKeyRef.current, {
                customerId: user.id,
                packageId: selectedPackage.id,
                packageName: selectedPackage.name,
                amount: selectedPackage.sellingPrice * quantity,
                customerName: user.name,
                phone: user.phone ?? '', // Gửi rỗng thay vì số giả — backend sẽ xử lý
                note: purchaseNote.trim() || 'Đặt mua từ Zalo Mini App',
                unitId: selectedPackage.unitId,
                productId: selectedPackage.productId,
                quantity: quantity
            });

            if (res && res.orderId) {
                setSuccessOrder({
                    orderId: res.orderId,
                    message: res.message || 'Đặt hàng thành công! Voucher sẽ gửi qua Zalo'
                });
                setSelectedPackage(null); // Đóng popup xác nhận
            } else {
                throw new Error('Đặt hàng thất bại');
            }
        } catch (err: any) {
            console.error('Lỗi khi đặt mua gói hàng:', err);
            if (err.message === 'PACKAGE_OUT_OF_STOCK') {
                setPurchaseError('Gói hàng này đã hết suất ưu đãi. Vui lòng chọn gói khác!');
            } else {
                setPurchaseError('Hệ thống đang bận. Vui lòng thử lại sau ít phút!');
            }
        } finally {
            setPurchasing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-brand-cream font-sans">
            {/* Header */}
            <div className="px-6 pt-12 pb-4 flex items-center z-10 bg-brand-cream sticky top-0 border-b border-gray-100/50">
                <button 
                    onClick={() => navigate(-1)} 
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-dark shadow-soft active:scale-95 transition-transform mr-3"
                >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                <h1 className="text-xl font-bold text-brand-dark">Gói sản phẩm ExpressCafe</h1>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-24 pt-2 no-scrollbar">
                {error && (
                    <div className="bg-red-50 border border-red-100 rounded-[20px] p-4 text-center mb-6">
                        <AlertCircle className="text-red-500 mx-auto mb-2" size={32} />
                        <p className="text-red-600 font-bold text-sm mb-3">{error}</p>
                        <button 
                            onClick={loadPackages} 
                            className="px-6 py-2 bg-red-100 text-red-700 rounded-full font-bold text-xs active:scale-95 transition-transform"
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="animate-spin text-brand-primary mb-3" size={36} />
                        <p className="text-sm font-semibold text-brand-dark/60">Đang tải danh sách gói...</p>
                    </div>
                ) : packages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
                        <ShoppingBag size={48} className="mb-4 text-gray-300" />
                        <p className="font-semibold text-brand-dark">Chưa có gói sản phẩm nào</p>
                        <p className="text-xs text-gray-400 mt-1">Các chương trình ưu đãi đặc biệt sẽ sớm quay trở lại.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {packages.map((pkg) => {
                            const isDiscounted = pkg.originalPrice > pkg.sellingPrice;
                            return (
                                <div 
                                    key={pkg.id} 
                                    className="bg-white rounded-[24px] p-4 shadow-soft border border-gray-50 flex flex-col gap-3 relative transition-all duration-300 hover:shadow-md"
                                >
                                    {/* Thumbnail and Info */}
                                    <div className="flex gap-4">
                                        <div className="w-20 h-20 rounded-[18px] overflow-hidden bg-brand-light shrink-0 border border-gray-100 flex items-center justify-center">
                                            {pkg.imageUrl ? (
                                                <img 
                                                    src={api.getMediaUrl(pkg.imageUrl)} 
                                                    alt={pkg.name} 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=Cafe";
                                                    }}
                                                />
                                            ) : (
                                                <div className="text-brand-primary font-bold text-xl">☕</div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                            <div>
                                                <h3 className="font-bold text-brand-dark text-base leading-tight truncate">{pkg.name}</h3>
                                                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{pkg.description || 'Thưởng thức hương vị cafe đậm đà chuẩn vị.'}</p>
                                            </div>

                                            <div className="flex justify-between items-end mt-2">
                                                <div className="flex flex-col">
                                                    {isDiscounted && (
                                                        <span className="text-gray-300 text-xs line-through">{pkg.originalPrice.toLocaleString('vi-VN')}đ</span>
                                                    )}
                                                    <span className="text-brand-primary font-extrabold text-lg leading-none">{pkg.sellingPrice.toLocaleString('vi-VN')}đ</span>
                                                </div>

                                                <button 
                                                    onClick={() => handleOpenPurchase(pkg)}
                                                    className="px-5 py-2.5 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-sm active:scale-95 transition-transform"
                                                >
                                                    Mua ngay
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Popup 1: Xác nhận mua */}
            {selectedPackage && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in">
                    <div className="bg-white rounded-t-[32px] w-full max-w-md p-6 flex flex-col gap-4 shadow-xl border-t border-gray-100 max-h-[85vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-2 shrink-0"></div>
                        
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-brand-dark">Xác Nhận Đơn Hàng</h2>
                            <p className="text-xs text-gray-400 mt-1">Cảm ơn bạn đã tin dùng sản phẩm của ExpressCafe</p>
                        </div>

                        {purchaseError && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-red-600 text-xs font-bold leading-tight">{purchaseError}</p>
                            </div>
                        )}

                        {/* Cảnh báo khi user chưa có số điện thoại */}
                        {!user?.phone && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={14} />
                                <p className="text-amber-700 text-xs font-semibold leading-tight">
                                    Bạn chưa liên kết số điện thoại. Vui lòng cập nhật SĐT trong Hồ sơ để nhân viên có thể liên hệ khi cần.
                                </p>
                            </div>
                        )}

                        {/* Package Info Summary */}
                        <div className="bg-brand-cream/30 border border-gray-100 rounded-2xl p-4 flex gap-4">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center shrink-0">
                                {selectedPackage.imageUrl ? (
                                    <img 
                                        src={api.getMediaUrl(selectedPackage.imageUrl)} 
                                        alt={selectedPackage.name} 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <span className="text-lg">☕</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="font-bold text-brand-dark text-sm truncate">{selectedPackage.name}</h4>
                                <p className="text-brand-primary font-bold text-base mt-1">
                                    {selectedPackage.sellingPrice.toLocaleString('vi-VN')}đ
                                </p>
                            </div>
                        </div>

                        {/* Bộ chọn số lượng */}
                        <div className="flex items-center justify-between bg-brand-cream/10 border border-gray-100/50 rounded-2xl p-4">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-brand-dark uppercase tracking-wider text-gray-400">Số lượng mua</span>
                                <span className="text-[11px] text-gray-400 mt-0.5">Tối đa 20 gói/lần đặt</span>
                            </div>
                            <div className="flex items-center gap-3.5 bg-gray-50 border border-gray-100 rounded-xl p-1.5 shrink-0">
                                <button
                                    onClick={() => handleUpdateQuantity(-1)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-brand-dark shadow-sm hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                    disabled={quantity <= 1 || purchasing}
                                >
                                    <Minus size={14} strokeWidth={2.5} />
                                </button>
                                <span className="w-8 text-center font-extrabold text-base text-brand-dark select-none">
                                    {quantity}
                                </span>
                                <button
                                    onClick={() => handleUpdateQuantity(1)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-brand-dark shadow-sm hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                    disabled={quantity >= 20 || purchasing}
                                >
                                    <Plus size={14} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Tổng quan thanh toán tạm tính */}
                        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2 border border-gray-100/50">
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Đơn giá</span>
                                <span>{selectedPackage.sellingPrice.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Số lượng</span>
                                <span>x {quantity}</span>
                            </div>
                            {quantity > 1 && (
                                <div className="flex justify-between items-center text-xs text-brand-primary font-semibold bg-brand-primary/5 rounded-lg px-2.5 py-1.5">
                                    <span>Đặc quyền nhận được</span>
                                    <span>{quantity} mã Voucher 100%</span>
                                </div>
                            )}
                            <div className="h-px bg-gray-200/60 my-1"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-brand-dark">Tổng cộng tạm tính</span>
                                <span className="text-lg font-black text-brand-primary">
                                    {(selectedPackage.sellingPrice * quantity).toLocaleString('vi-VN')}đ
                                </span>
                            </div>
                        </div>

                        {/* Note Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-brand-dark uppercase tracking-wider text-gray-400">Ghi chú đơn hàng (Tùy chọn)</label>
                            <input 
                                type="text"
                                value={purchaseNote}
                                onChange={(e) => setPurchaseNote(e.target.value)}
                                placeholder="Ghi chú như: ít đường, giao giờ hành chính..."
                                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-brand-dark outline-none focus:border-brand-primary transition-colors"
                                disabled={purchasing}
                            />
                        </div>

                        <div className="text-center py-1">
                            <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                                <Sparkles size={12} className="text-brand-primary animate-pulse" />
                                {quantity > 1 ? `${quantity} mã Voucher` : 'Mã Voucher'} sẽ được gửi trực tiếp qua Zalo OA ngay sau khi hoàn thành.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-2 shrink-0">
                            <button 
                                onClick={handleCloseConfirm}
                                className="flex-1 py-3.5 bg-gray-100 text-brand-dark font-bold text-sm rounded-xl active:scale-95 transition-transform"
                                disabled={purchasing}
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={handleConfirmPurchase}
                                className="flex-[2] py-3.5 bg-brand-primary text-white font-extrabold text-sm rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                                disabled={purchasing}
                            >
                                {purchasing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Đang tạo đơn...
                                    </>
                                ) : (
                                    `Xác nhận - ${(selectedPackage.sellingPrice * quantity).toLocaleString('vi-VN')}đ`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Popup 2: Thông báo thành công */}
            {successOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl text-center border border-gray-100">
                        {/* Status Icon */}
                        <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                            <CheckCircle2 size={36} strokeWidth={2.5} />
                        </div>

                        <div>
                            <h2 className="text-xl font-extrabold text-brand-dark leading-tight">Đặt Hàng Thành Công!</h2>
                            <p className="text-xs text-gray-400 mt-1">Hóa đơn của bạn đã được đối tác POS ghi nhận.</p>
                        </div>

                        <div className="bg-brand-cream/30 border border-gray-100 rounded-2xl p-3.5 text-xs text-gray-500 leading-relaxed">
                            {successOrder.message}
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <button 
                                onClick={() => {
                                    setSuccessOrder(null);
                                    navigate('/package-orders');
                                }}
                                className="py-3 bg-brand-primary text-white font-extrabold text-sm rounded-xl shadow-md active:scale-95 transition-transform"
                            >
                                Xem lịch sử đơn hàng
                            </button>
                            <button 
                                onClick={() => setSuccessOrder(null)}
                                className="py-3 bg-gray-100 text-brand-dark font-bold text-sm rounded-xl active:scale-95 transition-transform"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
