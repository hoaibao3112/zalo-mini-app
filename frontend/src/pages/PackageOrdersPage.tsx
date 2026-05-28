import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Calendar, DollarSign, Tag, CheckCircle2, RefreshCw, Clipboard, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, PackageOrder } from '../lib/api';

export const PackageOrdersPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    
    const [orders, setOrders] = useState<PackageOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        loadOrders();
    }, [user]);

    const loadOrders = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await api.getPackageOrders(user.id);
            if (res && Array.isArray(res.orders)) {
                setOrders(res.orders);
            } else {
                setOrders([]);
            }
        } catch (err) {
            console.error('Lỗi tải lịch sử đơn hàng package:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status: string) => {
        const s = String(status || '').toUpperCase();
        switch (s) {
            case 'PENDING':
                return { text: 'Đang xử lý', color: 'bg-amber-50 text-amber-600 border-amber-100/50' };
            case 'CONFIRMED':
                return { text: 'Đã xác nhận', color: 'bg-blue-50 text-blue-600 border-blue-100/50' };
            case 'VOUCHER_SENT':
                return { text: 'Đã gửi voucher', color: 'bg-green-50 text-green-600 border-green-100/50' };
            case 'FAILED':
                return { text: 'Thất bại', color: 'bg-red-50 text-red-600 border-red-100/50' };
            default:
                return { text: status, color: 'bg-gray-50 text-gray-600 border-gray-100/50' };
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    const handleCopy = (code: string) => {
        // Sao chép mã voucher vào clipboard an toàn
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(code)
                    .then(() => {
                        setCopiedCode(code);
                        setTimeout(() => setCopiedCode(null), 2000);
                    })
                    .catch((err) => {
                        console.warn('Navigator clipboard fail, using fallback:', err);
                        runFallbackCopy(code);
                    });
            } else {
                runFallbackCopy(code);
            }
        } catch (e) {
            console.warn('Navigator clipboard error, using fallback:', e);
            runFallbackCopy(code);
        }
    };

    const runFallbackCopy = (code: string) => {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        // Tránh làm lệch cuộn trang
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setCopiedCode(code);
                setTimeout(() => setCopiedCode(null), 2000);
            } else {
                console.error('Fallback copy command was unsuccessful');
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    };


    return (
        <div className="flex flex-col h-full bg-brand-cream font-sans">
            {/* Header */}
            <div className="px-6 pt-12 pb-4 flex items-center z-10 bg-brand-cream sticky top-0 border-b border-gray-100/50 justify-between">
                <div className="flex items-center">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-dark shadow-soft active:scale-95 transition-transform mr-3"
                    >
                        <ChevronLeft size={20} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-xl font-bold text-brand-dark">Lịch sử đơn hàng</h1>
                </div>
                
                {user && (
                    <button 
                        onClick={loadOrders}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-dark shadow-soft active:scale-95 transition-transform"
                        disabled={loading}
                    >
                        <RefreshCw className={loading ? 'animate-spin text-gray-300' : 'text-brand-dark'} size={18} />
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-24 pt-2 no-scrollbar">
                {!user ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <AlertCircle size={48} className="mb-4 text-gray-300 animate-pulse" />
                        <p className="font-semibold text-brand-dark">Chưa đăng nhập tài khoản</p>
                        <p className="text-xs text-gray-400 mt-1 mb-4">Vui lòng đăng nhập Zalo để truy cập lịch sử đơn hàng của bạn.</p>
                        <button 
                            onClick={login}
                            className="px-6 py-3 bg-brand-primary text-white font-extrabold text-sm rounded-xl shadow-md active:scale-95 transition-transform"
                        >
                            Đăng nhập ngay
                        </button>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="animate-spin text-brand-primary mb-3" size={36} />
                        <p className="text-sm font-semibold text-brand-dark/60">Đang tải lịch sử đơn hàng...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
                        <Tag size={48} className="mb-4 text-gray-300" />
                        <p className="font-semibold text-brand-dark">Bạn chưa có đơn hàng nào</p>
                        <p className="text-xs text-gray-400 mt-1">Các gói hàng bạn mua từ POS sẽ xuất hiện tại đây.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => {
                            const statusStyle = getStatusStyle(order.status);
                            return (
                                <div 
                                    key={order.id} 
                                    className="bg-white rounded-[24px] p-4 shadow-soft border border-gray-50 flex flex-col gap-3 relative transition-all"
                                >
                                    {/* Top Row: Package Name & Status */}
                                    <div className="flex justify-between items-start gap-2">
                                        <h3 className="font-bold text-brand-dark text-base leading-tight pr-2 flex-1 min-w-0">
                                            {order.packageName}
                                        </h3>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 ${statusStyle.color}`}>
                                            {statusStyle.text}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 mt-1">
                                        <div className="flex items-center text-xs text-gray-400 gap-2">
                                            <Calendar size={14} className="text-gray-300shrink-0" />
                                            <span>{formatDate(order.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center text-xs text-brand-dark font-bold gap-2">
                                            <DollarSign size={14} className="text-brand-primary shrink-0" />
                                            <span className="text-brand-primary text-sm font-extrabold">
                                                {order.amount.toLocaleString('vi-VN')}đ
                                            </span>
                                        </div>
                                    </div>

                                    {/* Voucher code render (nếu có) */}
                                    {order.voucherCode && (
                                        <div className="mt-2 pt-2 border-t border-gray-50">
                                            <p className="text-[10px] font-bold text-brand-dark uppercase tracking-wider text-gray-400 mb-1.5">Mã Voucher của bạn:</p>
                                            <div className="bg-green-50/50 border border-green-100 rounded-xl p-3 flex justify-between items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                                    <span className="font-mono font-extrabold text-sm text-green-700 tracking-wider">
                                                        {order.voucherCode}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleCopy(order.voucherCode!)}
                                                    className="w-8 h-8 rounded-lg bg-white border border-green-100 flex items-center justify-center text-green-600 active:scale-90 transition-transform shrink-0"
                                                    title="Sao chép"
                                                >
                                                    {copiedCode === order.voucherCode ? (
                                                        <span className="text-[10px] font-extrabold text-green-600">Copied</span>
                                                    ) : (
                                                        <Clipboard size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
