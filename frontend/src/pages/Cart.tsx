import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Trash2, Minus, Plus, QrCode, Copy, CheckCircle2, Loader2, AlertCircle, Download, Smartphone, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useSnackbar } from 'zmp-ui';
import * as zmpSdk from 'zmp-sdk';
import { useTranslation } from 'react-i18next';

// Interface cho trạng thái QR Modal
interface QrPaymentState {
  orderId: string;
  paymentUrl: string;
  total: number;
  description: string;
}

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { openSnackbar } = useSnackbar();
  const { t } = useTranslation();

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');

  // QR Payment Modal state
  const [qrPayment, setQrPayment] = useState<QrPaymentState | null>(null);
  const [qrPolling, setQrPolling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    street: ''
  });
  const [useSavedAddress, setUseSavedAddress] = useState(false);

  useEffect(() => {
    if (user && (user as any).address && (user as any).city) {
      setUseSavedAddress(true);
      setCustomerInfo(prev => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || '',
        street: (user as any).address || '',
        province: `0|${(user as any).city}`,
        district: `0|${(user as any).district}`,
        ward: `0|${(user as any).ward}`
      }));
    } else if (user) {
      setCustomerInfo(prev => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);
  const [formError, setFormError] = useState('');
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [gpsDistance, setGpsDistance] = useState<string>('');
  const [fetchingGps, setFetchingGps] = useState(false);

  // Dừng polling khi unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleGetLocation = () => {
    setFetchingGps(true);
    const getCoordinates = (lat: number, lng: number) => {
      // Tọa độ định vị Express Cafe POS (Trung tâm Q1, TP.HCM)
      const shopLat = 10.776;
      const shopLng = 106.701;

      const R = 6371; // Bán kính trái đất (km)
      const dLat = (shopLat - lat) * Math.PI / 180;
      const dLng = (shopLng - lng) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(shopLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      setGpsDistance(`Chi nhánh cách bạn khoảng ${distance.toFixed(1)} km`);
      setFetchingGps(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          getCoordinates(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.error('[GPS_GEOLOCATION] Geolocation failed:', err);
          // Fallback giả lập vị trí trung tâm TP.HCM (Q3)
          setTimeout(() => {
            getCoordinates(10.772, 106.682);
          }, 1000);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setFetchingGps(false);
    }
  };

  // Address data states
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  useEffect(() => {
    // Fetch provinces
    fetch('https://provinces.open-api.vn/api/p/')
      .then(res => res.json())
      .then(data => setProvinces(data))
      .catch(err => console.error('Failed to load provinces', err));
  }, []);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCustomerInfo(prev => ({ ...prev, province: val, district: '', ward: '' }));
    setDistricts([]);
    setWards([]);
    if (val) {
      const code = val.split('|')[0];
      fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`)
        .then(res => res.json())
        .then(data => setDistricts(data.districts || []));
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCustomerInfo(prev => ({ ...prev, district: val, ward: '' }));
    setWards([]);
    if (val) {
      const code = val.split('|')[0];
      fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`)
        .then(res => res.json())
        .then(data => setWards(data.wards || []));
    }
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCustomerInfo(prev => ({ ...prev, ward: e.target.value }));
  };

  const subtotal = cartItems.reduce((acc, item) => acc + ((item.salePrice || item.price) * item.quantity), 0);
  const hasEcomItem = cartItems.some(item => (item as any).externalId || String(item.id).startsWith('nh_') || String(item.id).startsWith('hv_'));
  const shippingFee = (hasEcomItem && deliveryType === 'DELIVERY') ? 15000 : 0;
  const total = subtotal + shippingFee;

  // Hàm copy nhanh thông tin thanh toán
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for non-HTTPS
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  // Bắt đầu polling trạng thái thanh toán
  const startPaymentPolling = (orderId: string) => {
    setQrPolling(true);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const result = await api.getOrderPaymentStatus(orderId);
        if (result?.paymentStatus === 'PAID') {
          // Dừng polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setQrPolling(false);
          setQrPayment(null);
          clearCart();
          openSnackbar({ text: '🎉 Thanh toán thành công! Đơn hàng đang được xử lý.', type: 'success' });
          navigate('/orders');
        }
      } catch (err) {
        console.error('[QrPolling] Lỗi kiểm tra trạng thái:', err);
      }
    }, 3000); // Poll mỗi 3 giây
  };

  // Đóng QR Modal và hủy polling
  const handleCloseQrModal = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setQrPolling(false);
    setQrPayment(null);
    openSnackbar({ text: 'Đã hủy thanh toán. Đơn hàng đang chờ thanh toán.', type: 'warning' });
  };

  // Lưu ảnh QR VietQR vào Album ảnh của điện thoại (Zalo SDK)
  const handleSaveQrToAlbum = async () => {
    if (!qrImageUrl) return;
    try {
      if (zmpSdk && (zmpSdk as any).saveImageToPhotosAlbum) {
        (zmpSdk as any).saveImageToPhotosAlbum({
          imageUrl: qrImageUrl,
          success: () => {
            openSnackbar({ text: '📥 Đã lưu mã QR vào Thư viện ảnh thành công!', type: 'success' });
          },
          fail: (err: any) => {
            console.error('Save to album failed via SDK', err);
            // Fallback mở tab mới
            window.open(qrImageUrl, '_blank');
            openSnackbar({ text: 'Bạn có thể chụp màn hình QR hoặc nhấn giữ ảnh để tải về nhé!', type: 'warning' });
          }
        });
      } else {
        window.open(qrImageUrl, '_blank');
        openSnackbar({ text: 'Nhấn giữ ảnh QR trên trình duyệt để tải về máy nhé!', type: 'info' });
      }
    } catch (err: any) {
      console.error('[SaveQR] Error:', err);
      window.open(qrImageUrl, '_blank');
      openSnackbar({ text: 'Chụp ảnh màn hình QR hoặc nhấn giữ ảnh để tải về máy!', type: 'info' });
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    // Validate form
    if (deliveryType === 'DELIVERY') {
      if (!customerInfo.name || !customerInfo.phone || !customerInfo.province || !customerInfo.district || !customerInfo.ward || !customerInfo.street) {
        setFormError('Vui lòng nhập đầy đủ thông tin giao hàng!');
        document.getElementById('shipping-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    } else {
      if (!customerInfo.name || !customerInfo.phone) {
        setFormError('Vui lòng nhập họ tên và số điện thoại liên hệ!');
        document.getElementById('shipping-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!pickupTime) {
        setFormError('Vui lòng chọn thời gian hẹn lấy nước!');
        document.getElementById('shipping-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    const phoneRegex = /^(0|84|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(customerInfo.phone.replace(/[\s.-]/g, ''))) {
      setFormError('Số điện thoại không hợp lệ!');
      document.getElementById('shipping-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFormError('');

    if (!user) {
      openSnackbar({ text: 'Vui lòng đăng nhập để đặt hàng!', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      const customerId = user.id;

      const provinceName = deliveryType === 'DELIVERY' ? customerInfo.province.split('|')[1] : '';
      const districtName = deliveryType === 'DELIVERY' ? customerInfo.district.split('|')[1] : '';
      const wardName = deliveryType === 'DELIVERY' ? customerInfo.ward.split('|')[1] : '';
      const fullAddress = deliveryType === 'DELIVERY' ? `${customerInfo.street}, ${wardName}, ${districtName}, ${provinceName}` : '';

      // Nhóm các sản phẩm trong giỏ hàng theo Platform (LOCAL, NHANH hoặc HARAVAN)
      const itemsByPlatform: Record<string, typeof cartItems> = {};
      cartItems.forEach(item => {
        let platform = 'LOCAL';
        if ((item as any).externalId) {
          platform = ((item as any).platform || 'NHANH').toUpperCase();
        } else if (item.id && (String(item.id).startsWith('nh_') || String(item.id).startsWith('hv_'))) {
          platform = String(item.id).startsWith('nh_') ? 'NHANH' : 'HARAVAN';
        }

        if (!itemsByPlatform[platform]) {
          itemsByPlatform[platform] = [];
        }
        itemsByPlatform[platform].push(item);
      });

      // Tạo các yêu cầu đặt hàng gộp
      const checkoutPromises = Object.keys(itemsByPlatform).map(platform => {
        const platformItems = itemsByPlatform[platform];

        if (platform === 'LOCAL') {
          const totalAmount = platformItems.reduce((sum, item) => sum + (item.salePrice || item.price) * item.quantity, 0);
          const pickupDateISO = pickupTime ? new Date(`${new Date().toDateString()} ${pickupTime}`).toISOString() : undefined;

          return api.createOrder({
            customerId,
            items: platformItems.map(item => ({
              productId: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.salePrice || item.price,
              size: item.size || 'M',
              milkLevel: item.milkLevel || 50,
              image: item.image || ''
            })),
            total: totalAmount,
            deliveryType,
            pickupTime: pickupDateISO,
            note: deliveryType === 'PICKUP' ? pickupNote : undefined,
            paymentMethod: paymentMethod
          } as any).then(res => {
            if (!res || res.error || res.success === false) {
              throw new Error(res?.message || res?.error || 'Lỗi đặt hàng sản phẩm local');
            }
            return res;
          });
        } else {
          // Sản phẩm E-commerce — gửi paymentMethod cho backend
          return api.createEcomOrder({
            customerId,
            platform,
            items: platformItems.map(item => ({
              externalProductId: (item as any).externalId
                ? Number((item as any).externalId)
                : Number(String(item.id).replace(/^(nh_|hv_)/, '')),
              externalVariantId: (item as any).variantId
                ? Number((item as any).variantId)
                : ((item as any).externalVariantId ? Number((item as any).externalVariantId) : undefined),
              quantity: item.quantity,
              unitPrice: item.salePrice || item.price,
              name: item.name || '',
              image: item.image || ''
            })),
            note: platformItems.map(item => `${item.name} (Size: ${item.size || 'M'}, Sữa: ${item.milkLevel || 50}%)`).join('; '),
            shippingAddress: {
              name: customerInfo.name,
              phone: customerInfo.phone,
              address: fullAddress,
              city: provinceName,
              district: districtName,
              ward: wardName
            },
            paymentMethod,
          }).then(res => {
            if (!res || res.error || res.success === false) {
              throw new Error(res?.message || res?.error || 'Lỗi đặt hàng từ máy chủ e-commerce');
            }
            return res;
          });
        }
      });

      const results = await Promise.all(checkoutPromises);

      // Kiểm tra nếu có đơn ONLINE — mở QR Modal thay vì chuyển trang
      if (paymentMethod === 'ONLINE') {
        const ecomResult = results.find((r: any) => r?.paymentUrl);
        const orderId = ecomResult?.internalOrderId || ecomResult?.id;
        if (ecomResult?.paymentUrl && orderId) {
          setQrPayment({
            orderId: orderId,
            paymentUrl: ecomResult.paymentUrl,
            total: total,
            description: ecomResult.paymentCode || '',
          });
          startPaymentPolling(orderId);
          return; // Không clearCart hay navigate ngay
        }
      }

      // COD flow: hiện thành công và chuyển trang
      openSnackbar({ text: 'Đặt hàng thành công!', type: 'success' });
      clearCart();
      navigate('/orders');
    } catch (err: any) {
      console.error('Checkout error:', err);
      openSnackbar({ text: err.message || 'Đặt hàng thất bại. Vui lòng thử lại!', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetAddressForm = () => {
    setUseSavedAddress(false);
    setCustomerInfo(prev => ({
      ...prev,
      province: '',
      district: '',
      ward: '',
      street: ''
    }));
    setDistricts([]);
    setWards([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  };

  // =============================================
  // QR VietQR Payment Info (từ PayOS payment link)
  // PayOS tự tạo QR, ta dùng checkoutUrl để tạo QR image
  // =============================================
  const qrImageUrl = qrPayment
    ? (qrPayment.paymentUrl.includes('vietqr.io') || qrPayment.paymentUrl.includes('qr.sepay.vn')
      ? qrPayment.paymentUrl
      : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayment.paymentUrl)}&ecc=M`)
    : null;

  return (
    <div className="flex flex-col h-full bg-brand-cream font-sans relative">
      {/* ============================================================ */}
      {/* QR Payment Overlay Modal */}
      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* QR Payment Overlay Modal */}
      {/* ============================================================ */}
      {qrPayment && (() => {
        const isMockPayment = qrPayment.paymentUrl.includes('mock-checkout');
        // Tạo link VietQR Quick Link hỗ trợ mở app ngân hàng tự động trên điện thoại
        const quickLinkUrl = qrPayment.paymentUrl.includes('img.vietqr.io/image/')
          ? qrPayment.paymentUrl.replace('img.vietqr.io/image/', 'qr.vietqr.co/2/')
          : qrPayment.paymentUrl;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end justify-center">
            <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-10 shadow-2xl animate-slide-up border-t border-gray-100 max-h-[92vh] overflow-y-auto no-scrollbar">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-green-600">Thanh Toán VietQR</p>
                  <h2 className="text-lg font-extrabold text-slate-800 mt-0.5">Quét mã hoặc mở App thanh toán</h2>
                </div>
                <button
                  onClick={handleCloseQrModal}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-90 transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Mobile Friendly Alert */}
              <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-3 mb-4 text-[11px] text-amber-800 font-semibold leading-relaxed flex items-start gap-2 shadow-sm">
                <Smartphone size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                  {isMockPayment
                    ? "Bạn đang ở môi trường Dev. Nhấn nút xanh lục bên dưới để mở trang giả lập chuyển khoản và xác nhận thanh toán."
                    : "Nếu chỉ có 1 điện thoại, hãy nhấn nút 'Mở App Ngân hàng' để tự động mở ứng dụng ngân hàng và chuyển khoản không cần quét mã QR!"}
                </p>
              </div>

              {/* QR Code & Save image */}
              <div className="flex flex-col items-center mb-4">
                <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-[24px] p-4 border border-green-100 shadow-inner relative group">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt="VietQR Code"
                      className="w-[190px] h-[190px] rounded-xl object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                {/* Nút lưu ảnh vào máy */}
                <button
                  onClick={handleSaveQrToAlbum}
                  className="mt-3 px-4 py-2 bg-red-50 hover:bg-red-100 text-[#E53E3E] text-xs font-extrabold rounded-full border border-red-200/50 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={13} />
                  <span>Lưu mã QR vào máy</span>
                </button>
              </div>

              {/* Payment Details */}
              <div className="space-y-2.5 mb-5 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs">
                {/* Số tiền */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-semibold">Số tiền cần trả</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[#E53E3E] text-sm">
                      {qrPayment.total.toLocaleString()}đ
                    </span>
                    <button
                      onClick={() => handleCopy(String(qrPayment.total), 'amount')}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#E53E3E] hover:border-red-400 transition-all active:scale-90 shadow-sm"
                    >
                      {copied === 'amount' ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {/* Nội dung chuyển khoản */}
                {qrPayment.description && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-semibold">Nội dung chuyển khoản</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 font-mono bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                        {qrPayment.description}
                      </span>
                      <button
                        onClick={() => handleCopy(qrPayment.description, 'desc')}
                        className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#E53E3E] hover:border-red-400 transition-all active:scale-90 shadow-sm"
                      >
                        {copied === 'desc' ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* HÀNH ĐỘNG CHÍNH: Mở App Ngân hàng hoặc Trang giả lập */}
              <div className="mb-5">
                {isMockPayment ? (
                  <a
                    href={qrPayment.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold rounded-2xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-105 text-center"
                  >
                    <Smartphone size={16} />
                    <span>Mở trang giả lập thanh toán 🧪</span>
                  </a>
                ) : (
                  <a
                    href={quickLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-105 text-center"
                  >
                    <Smartphone size={16} />
                    <span>Mở App Ngân hàng 📲</span>
                  </a>
                )}
              </div>

              {/* Polling status */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                {qrPolling ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-green-500" />
                    <span className="font-semibold text-green-600">Đang chờ hệ thống xác nhận thanh toán...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} />
                    <span>Chưa kết nối polling</span>
                  </>
                )}
              </div>

              {/* Note */}
              <p className="text-[10px] text-gray-400 text-center mt-3">
                ✓ Miễn phí giao dịch • Đơn hàng tự động xác nhận sau khi nhận tiền
              </p>
            </div>
          </div>
        );
      })()}


      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center z-10 sticky top-0 bg-brand-cream/90 backdrop-blur-md border-b border-gray-100/50">
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-slate-800 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          <ChevronLeft size={24} strokeWidth={2.5} className="-ml-1" />
        </button>
        <h1 className="flex-1 text-center text-xl font-extrabold text-slate-800 mr-11">{t('cart_title')}</h1>
      </div>

      {/* Cart Items List & Form */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-80 space-y-5 no-scrollbar">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 bg-[#FFF0E6] rounded-[24px] flex items-center justify-center mb-4">
              <Trash2 size={28} className="text-[#E53E3E] opacity-80" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 mb-1">{t('cart_empty_title')}</h3>
            <p className="text-gray-400 text-xs mb-6">{t('cart_empty_subtitle')}</p>
            <button onClick={() => navigate('/')} className="px-8 py-3 bg-[#E53E3E] text-white rounded-full text-xs font-extrabold active:scale-95 transition-transform shadow-md hover:bg-[#D32F2F]">
              {t('cart_explore_menu')}
            </button>
          </div>
        ) : (
          <>
            {/* 1. Green Info Banner (for Haravan delivery sync) */}
            {hasEcomItem && (
              <div className="bg-[#E6F4EA] border border-[#A7E1C4]/20 rounded-[22px] p-4 text-[#137333] text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                <span className="text-sm shrink-0 mt-0.5">✓</span>
                <p>Đơn hàng bán lẻ sẽ tự động đồng bộ qua hệ thống Haravan để đảm bảo vận chuyển nhanh chóng nhất.</p>
              </div>
            )}

            {/* 2. DỰ KIẾN CHUẨN BỊ (estimated prep scheduler) */}
            <div className="bg-[#FFF4E5] border border-[#FFE0B2]/20 rounded-[22px] p-4 flex justify-between items-center shadow-soft">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-orange-500 tracking-wider">{t('cart_estimated_prep')}</p>
                <h3 className="font-extrabold text-base text-amber-700 mt-1">{t('cart_estimated_ready')}</h3>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-xl border border-orange-100/50 shadow-sm shrink-0">
                <span className="font-extrabold text-amber-700 text-xs font-mono">#COFFEE-88</span>
              </div>
            </div>

            {/* 3. Danh sách món trong giỏ hàng */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider text-gray-400">{t('cart_your_items')}</h3>
              {cartItems.map((item) => {
                const isEcom = (item as any).externalId || String(item.id).startsWith('nh_') || String(item.id).startsWith('hv_');
                return (
                  <div key={item.cartId} className="bg-white rounded-[28px] p-4 flex items-center shadow-soft border border-gray-100/40 relative group">
                    <div className="w-16 h-16 rounded-[18px] overflow-hidden mr-4 flex-shrink-0 bg-brand-light border border-gray-100">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-slate-800 text-sm leading-tight truncate">{item.name}</h3>
                        {isEcom && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold text-white bg-purple-600">HARAVAN</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        {isEcom
                          ? 'Bịch 500g, Nguyên hạt'
                          : (item.size
                            ? `Size ${item.size} • ${item.milkLevel}% Sugar`
                            : 'Sản phẩm local')}
                      </p>
                      <p className="text-[#E53E3E] font-extrabold text-sm mt-1">{(item.salePrice || item.price).toLocaleString()}đ</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 justify-between h-full shrink-0">
                      <button
                        onClick={() => removeFromCart(item.cartId)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="flex items-center bg-brand-gray/80 rounded-xl p-0.5 border border-gray-100">
                        <button
                          onClick={() => item.quantity > 1 ? updateQuantity(item.cartId, item.quantity - 1) : removeFromCart(item.cartId)}
                          className="w-6 h-6 flex items-center justify-center bg-white rounded-lg text-slate-800 shadow-sm active:scale-90 transition-transform"
                        >
                          <Minus size={12} strokeWidth={3} />
                        </button>
                        <span className="text-xs font-extrabold text-slate-800 w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-[#E53E3E] text-white rounded-lg shadow-sm active:scale-90 transition-transform hover:bg-[#D32F2F]"
                        >
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4. Đổi điểm thưởng thành viên */}
            <div className="bg-white rounded-[24px] p-4 flex justify-between items-center shadow-soft border border-gray-100/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[16px] bg-[#FFF0E6] flex items-center justify-center text-[#E53E3E]">
                  <span>🌱</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs">{t('cart_bean_redeem')}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t('cart_bean_balance', { count: 245 })}</p>
                </div>
              </div>
              <input type="checkbox" className="w-5 h-5 rounded-md accent-[#E53E3E] scale-95 border-gray-200 outline-none" />
            </div>

            {/* 5. Form Thông tin giao hàng / Nhận nước */}
            <div id="shipping-form" className="mt-4 bg-white rounded-[28px] p-5 shadow-soft border border-gray-100/40">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider text-gray-400">{t('cart_shipping_method')}</h3>
              </div>

              {/* Delivery Type Selector Tabs */}
              <div className="grid grid-cols-2 p-1 bg-brand-gray/80 border border-gray-100 rounded-2xl mb-5">
                <button
                  type="button"
                  onClick={() => { setDeliveryType('DELIVERY'); setFormError(''); }}
                  className={`py-2.5 text-xs font-extrabold uppercase rounded-xl transition-all ${deliveryType === 'DELIVERY'
                    ? 'bg-[#F6E1B7] text-[#E53E3E] shadow-sm font-black'
                    : 'text-slate-500 hover:bg-gray-100/50'
                    }`}
                >
                  {t('cart_delivery_tab')}
                </button>
                <button
                  type="button"
                  onClick={() => { setDeliveryType('PICKUP'); setFormError(''); }}
                  className={`py-2.5 text-xs font-extrabold uppercase rounded-xl transition-all ${deliveryType === 'PICKUP'
                    ? 'bg-[#F6E1B7] text-[#E53E3E] shadow-sm font-black'
                    : 'text-slate-500 hover:bg-gray-100/50'
                    }`}
                >
                  {t('cart_pickup_tab')}
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold leading-tight">
                  {formError}
                </div>
              )}
              <div className="space-y-4">
                {deliveryType === 'DELIVERY' && useSavedAddress ? (
                  /* Thẻ tóm tắt địa chỉ giao hàng mặc định */
                  <div className="bg-gradient-to-br from-[#FFFBEB] to-[#FFFaf5] border border-orange-100/60 rounded-3xl p-5 shadow-soft mt-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/30 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-4 border-b border-orange-100/40 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🛵</span>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-700">Địa chỉ nhận hàng mặc định</h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetAddressForm}
                        className="px-3 py-1.5 bg-white hover:bg-orange-50 text-amber-700 text-[10px] font-extrabold rounded-full border border-amber-200/50 active:scale-95 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        ✏️ Thay đổi địa chỉ
                      </button>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-orange-100/50 flex items-center justify-center shrink-0 shadow-sm">
                          <span className="text-sm">👤</span>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Người nhận</p>
                          <p className="font-extrabold text-slate-800 text-xs mt-0.5">{customerInfo.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-orange-100/50 flex items-center justify-center shrink-0 shadow-sm">
                          <span className="text-sm">📞</span>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Số điện thoại</p>
                          <p className="font-extrabold text-slate-800 text-xs mt-0.5">{customerInfo.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-orange-100/50 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                          <span className="text-sm">📍</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider">Địa chỉ giao hàng</p>
                          <p className="font-extrabold text-slate-800 text-xs mt-0.5 leading-relaxed break-words">
                            {customerInfo.street}, {customerInfo.ward.includes('|') ? customerInfo.ward.split('|')[1] : customerInfo.ward}, {customerInfo.district.includes('|') ? customerInfo.district.split('|')[1] : customerInfo.district}, {customerInfo.province.includes('|') ? customerInfo.province.split('|')[1] : customerInfo.province}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-emerald-50/60 border border-emerald-100/40 rounded-2xl text-[10px] text-emerald-800 font-semibold leading-relaxed flex items-center gap-2">
                      <span className="text-xs">✨</span>
                      <span>Đã tự động áp dụng thông tin giao hàng đã lưu trong Hồ sơ của bạn!</span>
                    </div>
                  </div>
                ) : (
                  /* Form điền thông tin nhập tay thông thường */
                  <>
                    <div>
                      <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Họ và tên <span className="text-red-400">*</span></label>
                      <input
                        type="text" name="name" value={customerInfo.name} onChange={handleInputChange}
                        placeholder="Nguyễn Văn A"
                        className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-4 text-slate-800 text-sm outline-none focus:border-red-400 transition-all font-medium font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Số điện thoại <span className="text-red-400">*</span></label>
                      <input
                        type="tel" name="phone" value={customerInfo.phone} onChange={handleInputChange}
                        placeholder="0901234567" maxLength={10}
                        className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-4 text-slate-800 text-sm outline-none focus:border-red-400 transition-all font-medium font-sans"
                      />
                    </div>

                    {deliveryType === 'DELIVERY' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Tỉnh / Thành phố <span className="text-red-400">*</span></label>
                            <select
                              name="province" value={customerInfo.province} onChange={handleProvinceChange}
                              className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-3 text-slate-800 text-sm outline-none focus:border-red-400 transition-all appearance-none font-medium font-sans cursor-pointer"
                            >
                              <option value="" disabled>Chọn Tỉnh/Thành</option>
                              {provinces.map((p: any) => (
                                <option key={p.code} value={`${p.code}|${p.name}`}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Quận / Huyện <span className="text-red-400">*</span></label>
                            <select
                              name="district" value={customerInfo.district} onChange={handleDistrictChange} disabled={!customerInfo.province}
                              className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-3 text-slate-800 text-sm outline-none focus:border-red-400 transition-all appearance-none disabled:opacity-50 font-medium font-sans cursor-pointer"
                            >
                              <option value="" disabled>Chọn Quận/Huyện</option>
                              {districts.map((d: any) => (
                                <option key={d.code} value={`${d.code}|${d.name}`}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Phường / Xã <span className="text-red-400">*</span></label>
                          <select
                            name="ward" value={customerInfo.ward} onChange={handleWardChange} disabled={!customerInfo.district}
                            className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-4 text-slate-800 text-sm outline-none focus:border-red-400 transition-all appearance-none disabled:opacity-50 font-medium font-sans cursor-pointer"
                          >
                            <option value="" disabled>Chọn Phường/Xã</option>
                            {wards.map((w: any) => (
                              <option key={w.code} value={`${w.code}|${w.name}`}>{w.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Địa chỉ cụ thể <span className="text-red-400">*</span></label>
                          <input
                            type="text" name="street" value={customerInfo.street} onChange={handleInputChange}
                            placeholder="Số nhà, tên đường..."
                            className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-4 text-slate-800 text-sm outline-none focus:border-red-400 transition-all font-medium font-sans"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-[#FFF8F0] border border-orange-100/60 rounded-2xl p-4 mb-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] uppercase font-extrabold text-orange-400 tracking-wider">Chi Nhánh Nhận Hàng</p>
                            <button
                              type="button"
                              onClick={handleGetLocation}
                              disabled={fetchingGps}
                              className="text-[10px] font-bold text-[#E53E3E] underline flex items-center gap-1 cursor-pointer"
                            >
                              {fetchingGps ? 'Đang định vị...' : '📍 Định vị GPS'}
                            </button>
                          </div>
                          <h4 className="font-extrabold text-xs text-slate-800 mt-1">☕ Express Cafe - Mặc định Chi Nhánh POS</h4>
                          <p className="text-[10px] text-gray-400 mt-0.5">Chúng tôi sẽ chuẩn bị nước trước để bạn ghé lấy nhanh, không xếp hàng!</p>
                          {gpsDistance && (
                            <div className="mt-2 text-[10px] font-extrabold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg inline-block border border-green-100">
                              {gpsDistance}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Giờ hẹn lấy <span className="text-red-400">*</span></label>
                            <input
                              type="time"
                              name="pickupTime"
                              value={pickupTime}
                              onChange={(e) => setPickupTime(e.target.value)}
                              className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-4 text-slate-800 text-sm outline-none focus:border-red-400 transition-all font-medium font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">Thông tin xe (Giao tận xe)</label>
                            <input
                              type="text"
                              name="pickupNote"
                              value={pickupNote}
                              onChange={(e) => setPickupNote(e.target.value)}
                              placeholder="Ví dụ: SH Đỏ - 29X1-1234"
                              className="w-full bg-brand-cream/30 border border-gray-100/80 rounded-xl h-11 px-4 text-slate-800 text-sm outline-none focus:border-red-400 transition-all font-medium font-sans"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 italic">Nhập biển số hoặc màu xe để barista mang nước ra tận lề đường cho bạn nếu muốn nhận tại xe.</p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 6. Chọn Phương thức thanh toán */}
            <div className="bg-white rounded-[28px] p-5 shadow-soft border border-gray-100/40">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider text-gray-400 mb-4">{t('cart_payment_method')}</h3>
              <div className="space-y-3">
                {/* COD Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${paymentMethod === 'COD'
                      ? 'border-amber-400 bg-amber-50/30'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-lg shrink-0 ${paymentMethod === 'COD' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                    💵
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-extrabold text-slate-800 text-sm">{t('cart_payment_cod')}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t('cart_payment_cod_desc')}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === 'COD' ? 'border-amber-400' : 'border-gray-300'
                    }`}>
                    {paymentMethod === 'COD' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E53E3E]" />
                    )}
                  </div>
                </button>

                {/* VietQR Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ONLINE')}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${paymentMethod === 'ONLINE'
                      ? 'border-green-500 bg-[#F0FFF4]'
                      : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 ${paymentMethod === 'ONLINE' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                    <QrCode size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-extrabold text-slate-800 text-sm">{t('cart_payment_qr')}</p>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold text-white bg-green-500">ONLINE</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t('cart_payment_qr_desc')}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === 'ONLINE' ? 'border-green-500' : 'border-gray-300'
                    }`}>
                    {paymentMethod === 'ONLINE' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    )}
                  </div>
                </button>
              </div>

              {paymentMethod === 'ONLINE' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 font-semibold flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-green-500" />
                  {t('cart_payment_online_warning')}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Checkout Card */}
      {cartItems.length > 0 && (
        <div className="absolute bottom-6 left-6 right-6 bg-[#FEF9C3] rounded-[24px] p-5 border border-[#F6E1B7] shadow-[0_8px_30px_rgba(246,225,183,0.3)] z-20">
          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-gray-500 text-xs font-bold">
              <span>{t('cart_subtotal')}</span>
              <span className="text-slate-800 font-extrabold">{subtotal.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs font-bold">
              <span>{t('cart_shipping_fee')}</span>
              <span className="text-slate-800 font-extrabold">{shippingFee === 0 ? t('cart_shipping_free') : `${shippingFee.toLocaleString()}đ`}</span>
            </div>
            <div className="h-[1px] w-full bg-gray-200/60 my-1.5"></div>
            <div className="flex justify-between text-slate-800 font-extrabold text-[14px] items-end">
              <span>{t('cart_total')}</span>
              <span className="text-2xl text-[#E53E3E] leading-none font-black">{total.toLocaleString()}đ</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-extrabold text-white text-base active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-1.5 ${paymentMethod === 'ONLINE'
                ? 'bg-green-600 shadow-[0_4px_15px_rgba(34,197,94,0.3)]'
                : 'bg-[#E53E3E] shadow-[0_4px_15px_rgba(229,62,62,0.3)] hover:bg-[#D32F2F]'
              }`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('common_processing')}
              </>
            ) : paymentMethod === 'ONLINE' ? (
              <>
                <QrCode size={18} />
                {t('cart_checkout_online')}
              </>
            ) : (
              t('cart_checkout_cod')
            )}
          </button>
        </div>
      )}
    </div>
  );
};
