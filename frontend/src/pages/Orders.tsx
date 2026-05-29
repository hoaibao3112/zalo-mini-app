import React, { useEffect, useState, useRef } from 'react';
import { Clock, Package, CheckCircle, XCircle, ChevronRight, Loader2, RefreshCcw, Star, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/layout/BottomNav';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface OrderItem {
  productId?: string;
  externalProductId?: string | number;
  name?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  size?: string;
  milkLevel?: number;
  image?: string;
}

interface Order {
  id: string;
  status: string;
  createdAt: string;
  total: number;
  items: string;
  paymentCode?: string | null;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryType?: string;
  voucherCode?: string;
  errorMessage?: string;
}

// Safe clipboard copy (fallback cho môi trường không có HTTPS)
const safeCopy = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback: dùng execCommand (deprecated nhưng vẫn hoạt động)
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;pointer-events:none;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const success = document.execCommand('copy');
    document.body.removeChild(el);
    return success;
  } catch {
    return false;
  }
};

export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starRatings, setStarRatings] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);

  const fetchOrders = async (showRefreshSpin = false) => {
    if (!user) { setLoading(false); return; }
    if (showRefreshSpin) setRefreshing(true);
    try {
      const res = await api.getCustomerOrders(user.id);
      if (res && res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        setOrders(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      console.error('[Orders] Lỗi lấy danh sách đơn hàng:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [user]);

  const getStatusConfig = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'SUCCESS':
        return { text: 'Thành công', emoji: '✨', bg: 'bg-emerald-50', text_color: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', pulse: false };
      case 'CANCELLED':
        return { text: 'Đã hủy', emoji: '✕', bg: 'bg-red-50', text_color: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500', pulse: false };
      case 'SHIPPING':
        return { text: 'Đang giao', emoji: '🛵', bg: 'bg-blue-50', text_color: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', pulse: true };
      case 'DRAFT':
        return { text: 'Chờ duyệt', emoji: '⏳', bg: 'bg-amber-50', text_color: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400', pulse: true };
      case 'PENDING':
        return { text: 'Đang pha', emoji: '☕', bg: 'bg-orange-50', text_color: 'text-orange-600', border: 'border-orange-200', dot: 'bg-orange-500', pulse: true };
      case 'AWAITING_PAYMENT':
        return { text: 'Chờ thanh toán', emoji: '💳', bg: 'bg-purple-50', text_color: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', pulse: true };
      default:
        return { text: status || 'Không rõ', emoji: '•', bg: 'bg-slate-50', text_color: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400', pulse: false };
    }
  };

  const getProductNames = (itemsString: string) => {
    try {
      const items: OrderItem[] = JSON.parse(itemsString);
      return items.map(i => `${i.name || `Sản phẩm #${i.externalProductId || i.productId}`} (x${i.quantity})`).join(', ');
    } catch { return 'Không rõ sản phẩm'; }
  };

  const handleCopyId = async (id: string) => {
    const ok = await safeCopy(id);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyVoucher = async (code: string, orderId: string) => {
    const ok = await safeCopy(code);
    if (ok) {
      setCopiedVoucher(orderId);
      setTimeout(() => setCopiedVoucher(null), 2500);
    }
  };

  const handleStarRating = (orderId: string, star: number) => {
    setStarRatings(prev => ({ ...prev, [orderId]: star }));
  };

  return (
    <div className="flex flex-col h-full bg-brand-cream" style={{ fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" }}>

      {/* ── Header ── */}
      <div className="px-5 pt-12 pb-3 z-10 shrink-0 bg-brand-cream">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#3B251D] tracking-tight">Đơn Hàng</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{orders.length > 0 ? `${orders.length} đơn gần đây` : 'Lịch sử mua hàng của bạn'}</p>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 active:scale-90 transition-transform"
          >
            <RefreshCcw size={16} className={`text-[#5F3D2E] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── POS Package Banner ── */}
      <div className="px-5 pb-3 shrink-0">
        <button
          onClick={() => navigate('/package-orders')}
          className="w-full bg-gradient-to-r from-[#F5A623] via-[#F5B12E] to-[#F2C94C] text-[#3B251D] p-4 rounded-[22px] shadow-lg shadow-orange-500/10 active:scale-[0.98] transition-all flex items-center justify-between border border-white/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/30 rounded-xl flex items-center justify-center text-lg shrink-0 backdrop-blur-sm">☕</div>
            <div className="text-left">
              <h4 className="font-black text-sm leading-tight">Đơn Gói POS (Express Cafe)</h4>
              <p className="text-[10px] text-[#3B251D]/85 mt-0.5 font-bold">Xem lịch sử mua gói & lấy mã Voucher</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#3B251D] shrink-0" />
        </button>
      </div>

      {/* ── Content ── */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-5 pb-32 space-y-3.5 no-scrollbar">

        {/* Not logged in */}
        {!user ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6 mt-8">
            <div className="w-16 h-16 bg-slate-100 rounded-[24px] flex items-center justify-center mb-4">
              <XCircle size={28} className="text-slate-300" />
            </div>
            <p className="font-bold text-[#5F3D2E] text-base mb-1">Chưa đăng nhập</p>
            <p className="text-sm text-slate-400 leading-relaxed">Vui lòng đăng nhập Zalo để xem lịch sử đơn hàng.</p>
          </div>
        ) : loading ? (
          /* Loading skeleton */
          <div className="space-y-3.5 mt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-[24px] p-5 border border-slate-100 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-slate-100 rounded-lg" />
                  <div className="h-5 w-20 bg-slate-100 rounded-full" />
                </div>
                <div className="h-3 w-48 bg-slate-100 rounded-lg" />
                <div className="h-12 w-full bg-slate-50 rounded-2xl" />
                <div className="flex justify-between items-end">
                  <div className="h-6 w-24 bg-slate-100 rounded-lg" />
                  <div className="h-8 w-20 bg-slate-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 text-center mt-8">
            <div className="w-20 h-20 bg-[#FFF0E6] rounded-[28px] flex items-center justify-center mb-4 shadow-sm">
              <Package size={32} className="text-[#C89C76]" />
            </div>
            <p className="font-bold text-[#5F3D2E] text-base mb-1">Chưa có đơn hàng</p>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">Hãy khám phá menu và đặt ly đầu tiên nhé!</p>
            <button
              onClick={() => navigate('/')}
              className="px-7 py-3 bg-[#F6E1B7] text-[#5F3D2E] rounded-full text-sm font-bold border border-[#5F3D2E]/10 shadow-sm active:scale-95 transition-transform hover:bg-[#F6E1B7]/90"
            >
              Xem Menu ☕
            </button>
          </div>
        ) : (
          orders.map((order, index) => {
            const statusCfg = getStatusConfig(order.status);
            const isExpanded = expandedOrderId === order.id;
            const orderStatus = String(order.status || '').toUpperCase();
            let parsedItems: OrderItem[] = [];
            try { parsedItems = JSON.parse(order.items); } catch {}
            const isCopied = copiedId === order.id;
            const isVoucherCopied = copiedVoucher === order.id;
            const currentRating = starRatings[order.id] || 0;

            return (
              <div
                key={order.id}
                className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden"
                style={{
                  animation: `slideUpFadeIn 0.35s ease-out ${index * 0.06}s both`,
                  boxShadow: isExpanded
                    ? '0 8px 32px rgba(95,61,46,0.10), 0 1px 3px rgba(0,0,0,0.04)'
                    : '0 2px 8px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'box-shadow 0.3s ease',
                }}
              >
                {/* ── Card Header ── */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    {/* Order ID + copy */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[#3B251D] text-sm tracking-tight font-mono">
                          #{order.id.substring(0, 8).toUpperCase()}
                        </span>
                        <button
                          onClick={() => handleCopyId(order.id)}
                          className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-90"
                          title="Sao chép mã đơn"
                        >
                          {isCopied
                            ? <Check size={11} className="text-emerald-500" />
                            : <Copy size={11} className="text-slate-400" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
                        <Clock size={11} className="shrink-0" />
                        {new Date(order.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text_color} ${statusCfg.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${statusCfg.pulse ? 'animate-pulse' : ''} shrink-0`} />
                      <span>{statusCfg.emoji} {statusCfg.text}</span>
                    </div>
                  </div>

                  {/* Product summary */}
                  <div className="flex items-center gap-2 bg-slate-50 rounded-[14px] p-3 mb-3">
                    <Package size={14} className="text-[#C89C76] shrink-0" />
                    <span className="text-xs text-slate-600 font-semibold truncate">{getProductNames(order.items)}</span>
                  </div>

                  {/* Total + detail button */}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block">Tổng cộng</span>
                      <span className="text-[#E53E3E] font-black text-lg leading-tight">
                        {order.total.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 ${
                        isExpanded
                          ? 'bg-[#F6E1B7] text-[#5F3D2E] border border-[#5F3D2E]/20 shadow-md'
                          : 'bg-[#F6E1B7]/25 text-[#5F3D2E] hover:bg-[#F6E1B7]/40 border border-[#5F3D2E]/10'
                      }`}
                    >
                      {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                      <ChevronRight size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* ── Expanded Detail Panel ── */}
                {isExpanded && (
                  <div
                    className="border-t border-slate-100 px-4 pb-4 pt-4 space-y-4"
                    style={{ animation: 'expandDown 0.25s ease-out both' }}
                  >

                    {/* ─ PENDING / DRAFT: Barista Stepper ─ */}
                    {(orderStatus === 'PENDING' || orderStatus === 'DRAFT') && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/50 rounded-[20px] p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-black text-[#5F3D2E] text-[11px] uppercase tracking-wider">Trạng thái pha chế</h4>
                          <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold animate-pulse border border-orange-200/50">Đang chuẩn bị ☕</span>
                        </div>

                        {/* Steps */}
                        <div className="relative pl-8 space-y-4">
                          {/* Vertical track */}
                          <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="w-full bg-gradient-to-b from-[#C89C76] to-[#5F3D2E] rounded-full transition-all duration-1000"
                              style={{ height: orderStatus === 'PENDING' ? '55%' : '20%' }}
                            />
                          </div>

                          {[
                            { icon: '✓', label: 'Đã nhận đơn', sub: 'Hệ thống đã ghi nhận đơn hàng', done: true },
                            { icon: '☕', label: 'Barista đang pha', sub: 'Nhanh chóng pha chế ly nước của bạn...', done: orderStatus === 'PENDING', active: orderStatus === 'PENDING' },
                            { icon: '🔔', label: 'Sẵn sàng lấy', sub: 'Sẽ thông báo khi hoàn tất', done: false },
                          ].map((step, i) => (
                            <div key={i} className={`relative flex items-start gap-3 ${!step.done && !step.active ? 'opacity-35' : ''}`}>
                              <div className={`absolute -left-8 w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white shadow-sm text-[9px] shrink-0 ${
                                step.done && !step.active ? 'bg-[#C89C76] text-white' :
                                step.active ? 'bg-[#5F3D2E] text-white shadow-[0_0_10px_rgba(95,61,46,0.4)] animate-pulse scale-110' :
                                'bg-slate-100 text-slate-400'
                              }`}>
                                {step.icon}
                              </div>
                              <div>
                                <p className={`text-xs font-bold leading-tight ${step.active ? 'text-[#5F3D2E]' : 'text-slate-700'}`}>{step.label}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{step.sub}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─ SHIPPING: Timeline + Shipper card ─ */}
                    {orderStatus === 'SHIPPING' && (
                      <div className="space-y-3">
                        {/* Horizontal steps */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200/50 rounded-[20px] p-4">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-[#5F3D2E] text-[11px] uppercase tracking-wider">Tình trạng vận chuyển</h4>
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full border border-blue-200/50">🛵 Đang Giao</span>
                          </div>
                          <div className="flex items-center">
                            {['Tiếp nhận', 'Đóng gói', 'Đang giao', 'Thành công'].map((step, i) => {
                              const doneIndex = 2;
                              const isDone = i <= doneIndex - 1;
                              const isActive = i === doneIndex;
                              const isPending = i > doneIndex;
                              return (
                                <React.Fragment key={step}>
                                  <div className="flex flex-col items-center flex-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm ${
                                      isDone ? 'bg-[#5F3D2E] text-white' :
                                      isActive ? 'bg-blue-600 text-white shadow-blue-400/40 animate-pulse' :
                                      'bg-slate-100 text-slate-400'
                                    }`}>
                                      {isDone ? '✓' : isActive ? '🛵' : ''}
                                    </div>
                                    <span className={`text-[9px] font-bold mt-1.5 ${
                                      isActive ? 'text-blue-600' : isDone ? 'text-[#5F3D2E]' : 'text-slate-400'
                                    }`}>{step}</span>
                                  </div>
                                  {i < 3 && (
                                    <div className={`h-0.5 flex-1 mb-4 ${i < doneIndex ? 'bg-[#5F3D2E]' : 'bg-slate-100'}`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* Shipper info */}
                        <div className="flex items-center gap-3 bg-white border border-slate-100 p-3.5 rounded-[18px] shadow-sm">
                          <div className="w-11 h-11 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm shrink-0 flex items-center justify-center text-xl">🧑‍🦱</div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-black text-[#3B251D] text-xs truncate">Nguyễn Văn An</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">Tài xế Express · ⭐ 4.9</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => alert('Đang gọi shipper...')} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-sm active:scale-90 transition-transform shadow-sm">📞</button>
                            <button onClick={() => alert('Đang mở chat...')} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-sm active:scale-90 transition-transform shadow-sm">💬</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ─ SUCCESS: Full timeline + Voucher ticket + Review ─ */}
                    {orderStatus === 'SUCCESS' && (
                      <div className="space-y-3">
                        {/* Completed timeline */}
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/50 rounded-[20px] p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-black text-[#5F3D2E] text-[11px] uppercase tracking-wider">Trạng thái</h4>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full border border-emerald-200/50">✓ Đã Hoàn Thành</span>
                          </div>
                          <div className="flex items-center">
                            {['Tiếp nhận', 'Đóng gói', 'Giao hàng', 'Thành công'].map((step, i) => (
                              <React.Fragment key={step}>
                                <div className="flex flex-col items-center flex-1">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm ${i === 3 ? 'bg-emerald-600 text-white shadow-emerald-400/30' : 'bg-[#F6E1B7] text-[#5F3D2E]'}`}>✓</div>
                                  <span className={`text-[9px] font-bold mt-1.5 ${i === 3 ? 'text-emerald-600' : 'text-[#5F3D2E]'}`}>{step}</span>
                                </div>
                                {i < 3 && <div className="h-0.5 flex-1 mb-4 bg-[#F6E1B7]" />}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Voucher ticket */}
                        <div className="relative bg-gradient-to-br from-[#F5A623] via-[#F5B12E] to-[#F2C94C] rounded-[22px] p-5 shadow-lg overflow-hidden border border-white/20">
                          {/* Texture overlay */}
                          <div className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(45deg,white_0,white_1px,transparent_0,transparent_50%)] bg-[length:8px_8px]" />
                          {/* Notches */}
                          <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-brand-cream rounded-full" />
                          <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-brand-cream rounded-full" />
                          {/* Dashed divider */}
                          <div className="absolute inset-x-8 top-1/2 h-0 border-t border-dashed border-[#3B251D]/25" />

                          <div className="relative z-10">
                            <div className="text-center pb-5">
                              <span className="px-2.5 py-0.5 bg-[#3B251D] text-white text-[9px] font-black rounded-full uppercase tracking-wider">🎁 Voucher Đặc Quyền</span>
                              <h3 className="font-black text-sm text-[#3B251D] mt-2">Cảm ơn bạn đã mua hàng!</h3>
                              <p className="text-[10px] text-[#3B251D]/75 mt-1 font-bold">Tặng bạn ưu đãi giảm 20% cho đơn tiếp theo</p>
                            </div>
                            <div className="pt-5">
                              <div className="bg-white/20 border border-white/30 rounded-[14px] p-3 flex justify-between items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">🎫</span>
                                  <span className="font-mono font-black text-[#3B251D] tracking-widest text-sm uppercase">{order.voucherCode || 'EXPRESS20'}</span>
                                </div>
                                <button
                                  onClick={() => handleCopyVoucher(order.voucherCode || 'EXPRESS20', order.id)}
                                  className="px-3.5 py-1.5 bg-[#3B251D] hover:bg-[#3B251D]/90 active:scale-95 text-white text-[10px] font-black rounded-full transition-all shrink-0 flex items-center gap-1"
                                >
                                  {isVoucherCopied ? <><Check size={11} /> Đã sao!</> : <><Copy size={10} /> Sao chép</>}
                                </button>
                              </div>
                              <p className="text-[9px] text-[#3B251D]/60 text-center mt-2.5">Hạn dùng 30 ngày · Hóa đơn tối thiểu 100K</p>
                            </div>
                          </div>
                        </div>

                        {/* Review card */}
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-[18px] p-4 text-center">
                          <p className="text-xs font-black text-emerald-800">🎉 Đơn hàng đã hoàn thành xuất sắc!</p>
                          <p className="text-[10px] text-emerald-700 mt-1 font-medium">Bạn đánh giá dịch vụ lần này thế nào?</p>
                          <div className="flex justify-center gap-1.5 mt-2.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => handleStarRating(order.id, star)}
                                className="transition-transform active:scale-125"
                              >
                                <Star
                                  size={22}
                                  className={`transition-colors duration-200 ${star <= currentRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
                                />
                              </button>
                            ))}
                          </div>
                          {currentRating > 0 && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1.5 animate-fade-in">
                              {currentRating >= 5 ? '😍 Tuyệt vời! Cảm ơn bạn!' : currentRating >= 3 ? '😊 Cảm ơn phản hồi của bạn!' : '😔 Chúng tôi sẽ cố gắng hơn!'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ─ CANCELLED ─ */}
                    {orderStatus === 'CANCELLED' && (
                      <div className="bg-gradient-to-br from-red-50 to-rose-50/60 border border-red-100 rounded-[20px] p-5 text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-[16px] flex items-center justify-center text-2xl mx-auto mb-3">❌</div>
                        <h4 className="font-black text-red-800 text-sm mb-1">Đơn hàng đã bị hủy</h4>
                        <p className="text-[11px] text-red-600/80 font-semibold leading-relaxed mb-4">
                          {order.errorMessage || 'Đơn hàng này đã bị hủy. Xin lỗi vì sự bất tiện!'}
                        </p>
                        <button
                          onClick={() => navigate('/')}
                          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black rounded-full shadow-md shadow-red-600/15 transition-all w-full uppercase tracking-wide"
                        >
                          Đặt lại đơn mới →
                        </button>
                      </div>
                    )}

                    {/* ─ Order Item Detail List ─ */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-[#5F3D2E] text-[11px] uppercase tracking-wider">Món đặt</p>
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">{parsedItems.length} món</span>
                      </div>
                      <div className="space-y-2">
                        {parsedItems.map((item, idx) => {
                          const itemImage = item.image ? api.getMediaUrl(item.image) : '';
                          const itemPrice = item.price || item.unitPrice || 0;
                          return (
                            <div key={idx} className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-[16px] border border-slate-100">
                              {/* Thumbnail */}
                              <div className="w-12 h-12 rounded-[12px] overflow-hidden shrink-0 bg-white border border-slate-100 flex items-center justify-center">
                                {itemImage ? (
                                  <img src={itemImage} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/100?text=${encodeURIComponent((item.name || 'SP').substring(0, 2))}`; }} />
                                ) : (
                                  <span className="text-lg">☕</span>
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <p className="font-black text-[#3B251D] text-xs truncate">{item.name || `Sản phẩm #${item.externalProductId || item.productId}`}</p>
                                  {item.productId && (String(item.productId).startsWith('nh_') || String(item.productId).startsWith('hv_')) && (
                                    <span className="px-1 py-0.5 rounded text-[7px] font-black text-white bg-purple-600 shrink-0">Omni</span>
                                  )}
                                </div>
                                {item.size && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                                    Size {item.size}{item.milkLevel !== undefined ? ` · Sữa ${item.milkLevel}%` : ''}
                                  </p>
                                )}
                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">{itemPrice.toLocaleString('vi-VN')}đ</p>
                              </div>
                              {/* Qty + subtotal */}
                              <div className="text-right shrink-0">
                                <span className="text-xs font-extrabold text-slate-400">x{item.quantity}</span>
                                <p className="text-xs font-black text-[#5F3D2E] mt-0.5">{(itemPrice * item.quantity).toLocaleString('vi-VN')}đ</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total summary row */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                        <span className="text-xs font-bold text-slate-500">Tổng tiền đơn hàng</span>
                        <span className="text-sm font-black text-[#E53E3E]">{order.total.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Keyframe animations (injected once) ── */}
      <style>{`
        @keyframes slideUpFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes expandDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease both; }
      `}</style>

      <BottomNav />
    </div>
  );
};