import React, { useEffect, useState } from 'react';
import { Clock, Package, CheckCircle, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/layout/BottomNav';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export const Orders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchOrders = async () => {
      try {
        const res = await api.getCustomerOrders(user.id);
        if (res && res.success && Array.isArray(res.data)) {
          setOrders(res.data);
        } else {
          setOrders(Array.isArray(res) ? res : []);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách đơn hàng', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  const getStatusDisplay = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'SUCCESS': return { text: 'Thành công', color: 'bg-green-100 text-green-600' };
      case 'CANCELLED': return { text: 'Đã hủy', color: 'bg-red-100 text-red-500' };
      case 'SHIPPING': return { text: 'Đang giao', color: 'bg-blue-100 text-blue-600' };
      case 'DRAFT': return { text: 'Chờ duyệt', color: 'bg-orange-100 text-orange-600' };
      case 'PENDING': return { text: 'Đang xử lý', color: 'bg-orange-100 text-orange-600' };
      default: return { text: status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const getProductNames = (itemsString: string) => {
    try {
      const items = JSON.parse(itemsString);
      return items.map((i: any) => `${i.name || `Sản phẩm ${i.externalProductId || i.productId}`} (x${i.quantity})`).join(', ');
    } catch {
      return 'Không rõ sản phẩm';
    }
  };

  return (
    <div className="flex flex-col h-full bg-brand-cream">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 z-10">
        <h1 className="text-2xl font-bold text-brand-dark">Lịch Sử Đơn Hàng</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-4 no-scrollbar">
        {!user ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center px-6">
            <XCircle size={48} className="mb-4 opacity-30" />
            <p className="font-semibold text-brand-dark mb-1">Chưa đăng nhập</p>
            <p className="text-sm">Vui lòng đăng nhập Zalo để xem lịch sử đơn hàng.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
             <Loader2 size={32} className="animate-spin mb-4" />
             <p>Đang tải dữ liệu...</p>
          </div>
        ) : orders.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400">
             <Package size={48} className="mb-4 opacity-20" />
             <p>Chưa có đơn hàng nào.</p>
           </div>
        ) : (
          orders.map((order) => {
            const statusObj = getStatusDisplay(order.status);
            const isExpanded = expandedOrderId === order.id;
            const orderStatus = String(order.status || '').toUpperCase();
            let parsedItems: any[] = [];
            try { parsedItems = JSON.parse(order.items); } catch {}

            return (
              <div key={order.id} className="bg-white rounded-[20px] p-4 shadow-sm flex flex-col gap-3 transition-all">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className="font-bold text-brand-dark text-sm break-all pr-2 max-w-[200px]">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </h3>
                      <div className="flex items-center text-gray-400 text-xs mt-1">
                        <Clock size={12} className="mr-1" />
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </div>
                   </div>
                   <span className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${statusObj.color}`}>
                     {statusObj.text}
                   </span>
                </div>
                
                <div className="h-px bg-gray-100 w-full"></div>
                
                <div className="flex items-center text-brand-gray text-sm">
                   <Package size={16} className="mr-2 text-brand-primary flex-shrink-0" />
                   <span className="truncate">{getProductNames(order.items)}</span>
                </div>

                <div className="flex justify-between items-center mt-1">
                   <span className="text-brand-dark font-bold text-lg">
                     {order.total.toLocaleString()}đ
                   </span>
                   <button 
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="flex items-center text-brand-primary text-sm font-bold active:scale-95 transition-transform"
                   >
                      Chi tiết <ChevronRight size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                   </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-5 animate-fade-in">
                     {/* 1. If Pending or Draft: Show Barista Preparation Stepper */}
                     {(orderStatus === 'PENDING' || orderStatus === 'DRAFT') && (
                        <div className="bg-[#FDFBF7] border border-orange-100/30 rounded-[24px] p-4 shadow-soft">
                           <h4 className="font-extrabold text-[#5F3D2E] text-xs uppercase tracking-wider mb-3">Pha Chế</h4>
                           <div className="relative pl-6 space-y-4">
                              {/* Vertial Line */}
                              <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-orange-100"></div>
                              
                              {/* Step 1 */}
                              <div className="relative flex items-start gap-3">
                                 <div className="absolute -left-[23px] w-4.5 h-4.5 rounded-full bg-orange-700 flex items-center justify-center border-4 border-white shadow-sm shrink-0">
                                    <span className="text-[7px] text-white">✓</span>
                                 </div>
                                 <div>
                                    <p className="text-xs font-extrabold text-brand-dark leading-tight">Đã nhận đơn</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Hệ thống đã ghi nhận đơn hàng</p>
                                 </div>
                              </div>

                              {/* Step 2 */}
                              <div className="relative flex items-start gap-3">
                                 <div className="absolute -left-[23px] w-4.5 h-4.5 rounded-full bg-orange-700 flex items-center justify-center border-4 border-white shadow-sm shrink-0">
                                    <span className="text-[7px] text-white">☕</span>
                                 </div>
                                 <div>
                                    <p className="text-xs font-extrabold text-brand-dark leading-tight">Barista đang pha chế</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Đang nhanh chóng pha chế ly nước của bạn...</p>
                                 </div>
                              </div>

                              {/* Step 3 */}
                              <div className="relative flex items-start gap-3 opacity-40">
                                 <div className="absolute -left-[23px] w-4.5 h-4.5 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-sm shrink-0"></div>
                                 <div>
                                    <p className="text-xs font-extrabold text-brand-dark leading-tight">Sẵn sàng để lấy</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Sẽ thông báo khi hoàn tất</p>
                                 </div>
                              </div>
                           </div>
                        </div>
                     )}

                     {/* 2. If Shipping: Show Active Shipping Stepper & Interactive Driver Map */}
                     {orderStatus === 'SHIPPING' && (
                        <>
                           <div className="bg-white border border-gray-100 rounded-[24px] p-4 shadow-soft">
                              <div className="flex justify-between items-center mb-3">
                                 <h4 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider text-gray-400">Vận Chuyển</h4>
                                 <span className="px-2 py-0.5 bg-[#E6F4EA] text-[#137333] text-[9px] font-extrabold rounded-md uppercase">Đang Giao</span>
                              </div>

                              {/* Horizontal Timeline Steps */}
                              <div className="flex justify-between items-center gap-1 mb-4 pt-1 px-1">
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-brand-coffee text-white text-[9px] font-bold flex items-center justify-center shadow-sm">✓</div>
                                    <span className="text-[9px] font-bold text-brand-dark mt-1">Tiếp nhận</span>
                                 </div>
                                 <div className="h-0.5 bg-brand-coffee flex-1 mb-3"></div>
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-brand-coffee text-white text-[9px] font-bold flex items-center justify-center shadow-sm">✓</div>
                                    <span className="text-[9px] font-bold text-brand-dark mt-1">Đóng gói</span>
                                 </div>
                                 <div className="h-0.5 bg-brand-coffee flex-1 mb-3"></div>
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-brand-coffee text-white text-[9px] font-bold flex items-center justify-center shadow-sm animate-pulse">🛵</div>
                                    <span className="text-[9px] font-bold text-brand-dark mt-1">Đang giao</span>
                                 </div>
                                 <div className="h-0.5 bg-gray-100 flex-1 mb-3"></div>
                                 <div className="flex flex-col items-center flex-1 opacity-30">
                                    <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-[9px] font-bold flex items-center justify-center">✓</div>
                                    <span className="text-[9px] font-bold text-gray-400 mt-1">Thành công</span>
                                 </div>
                              </div>

                              {/* Shipper info section */}
                              <div className="flex items-center gap-3 bg-brand-gray/50 p-2.5 rounded-2xl border border-gray-50/50">
                                 <div className="w-10 h-10 rounded-full bg-brand-light overflow-hidden border border-gray-100 shrink-0">
                                    <img src="https://placehold.co/100x100?text=Shipper" alt="Shipper Avatar" className="w-full h-full object-cover" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h5 className="font-extrabold text-brand-dark text-xs truncate">Nguyễn Văn An</h5>
                                    <p className="text-[9px] text-gray-400 mt-0.5">Tài xế Express &middot; ★ 4.9</p>
                                 </div>
                                 <div className="flex gap-1.5 shrink-0">
                                    <button 
                                       onClick={() => alert('Đang gọi cho shipper Nguyễn Văn An...')}
                                       className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-brand-coffee shadow-sm active:scale-95 transition-all text-xs"
                                    >
                                       📞
                                    </button>
                                    <button 
                                       onClick={() => alert('Đang mở khung chat với shipper...')}
                                       className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-brand-coffee shadow-sm active:scale-95 transition-all text-xs"
                                    >
                                       💬
                                    </button>
                                 </div>
                              </div>
                           </div>

                           {/* Interactive Driver Map Simulator */}
                           <div className="bg-white border border-gray-100 rounded-[28px] p-4 shadow-soft">
                              <div className="flex justify-between items-center mb-3">
                                 <h4 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider text-gray-400">Vị Trí Tài Xế</h4>
                                 <span className="text-[10px] font-bold text-brand-coffee bg-[#FFF0E6] px-2 py-0.5 rounded">Cách bạn 1.2km</span>
                              </div>
                              {/* Map Simulator illustration */}
                              <div className="w-full h-40 rounded-[22px] overflow-hidden bg-emerald-50 border border-gray-100 relative shadow-inner">
                                 {/* Simulated roads using CSS lines */}
                                 <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
                                 <div className="absolute top-1/2 left-0 right-0 h-4 bg-white/80 shadow-sm transform -translate-y-1/2"></div>
                                 <div className="absolute left-1/3 top-0 bottom-0 w-4 bg-white/80 shadow-sm"></div>
                                 <div className="absolute right-1/4 top-0 bottom-0 w-4 bg-white/80 shadow-sm"></div>

                                 {/* Map Marker Red Pin */}
                                 <div className="absolute top-1/2 left-1/3 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <span className="text-2xl animate-bounce">📍</span>
                                    <div className="w-2.5 h-1 bg-black/20 rounded-full blur-xs"></div>
                                 </div>

                                 {/* Shipper Courier Pin */}
                                 <div className="absolute top-1/3 right-1/4 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-full bg-brand-coffee text-white flex items-center justify-center shadow-md border-2 border-white text-xs animate-pulse">🛵</div>
                                    <span className="px-1.5 py-0.5 bg-brand-dark text-white rounded text-[8px] font-bold mt-1 shadow-sm">Đang giao</span>
                                 </div>
                              </div>
                           </div>
                        </>
                     )}

                     {/* 3. If Success: Show Completed Stepper, Dashed Ticket Voucher & Review Card */}
                     {orderStatus === 'SUCCESS' && (
                        <>
                           <div className="bg-white border border-gray-100 rounded-[24px] p-4 shadow-soft">
                              <div className="flex justify-between items-center mb-3">
                                 <h4 className="font-extrabold text-brand-dark text-xs uppercase tracking-wider text-gray-400">Vận Chuyển</h4>
                                 <span className="px-2 py-0.5 bg-[#E6F4EA] text-[#137333] text-[9px] font-extrabold rounded-md uppercase">Đã Giao</span>
                              </div>

                              {/* Horizontal Timeline Steps */}
                              <div className="flex justify-between items-center gap-1 mb-2 pt-1 px-1">
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-brand-coffee text-white text-[9px] font-bold flex items-center justify-center shadow-sm">✓</div>
                                    <span className="text-[9px] font-bold text-brand-dark mt-1">Tiếp nhận</span>
                                 </div>
                                 <div className="h-0.5 bg-brand-coffee flex-1 mb-3"></div>
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-brand-coffee text-white text-[9px] font-bold flex items-center justify-center shadow-sm">✓</div>
                                    <span className="text-[9px] font-bold text-brand-dark mt-1">Đóng gói</span>
                                 </div>
                                 <div className="h-0.5 bg-brand-coffee flex-1 mb-3"></div>
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-brand-coffee text-white text-[9px] font-bold flex items-center justify-center shadow-sm">✓</div>
                                    <span className="text-[9px] font-bold text-brand-dark mt-1">Đang giao</span>
                                 </div>
                                 <div className="h-0.5 bg-brand-coffee flex-1 mb-3"></div>
                                 <div className="flex flex-col items-center flex-1">
                                    <div className="w-5 h-5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">✓</div>
                                    <span className="text-[9px] font-bold text-green-600 mt-1">Thành công</span>
                                 </div>
                              </div>
                           </div>

                           {/* Dashed Ticket Voucher Gift Card */}
                           <div className="bg-[#5F3D2E]/5 border border-[#5F3D2E]/10 rounded-[24px] p-5 shadow-soft relative overflow-hidden">
                              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-r border-[#5F3D2E]/10 shrink-0"></div>
                              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-l border-[#5F3D2E]/10 shrink-0"></div>

                              <div className="text-center relative z-10 px-2">
                                 <p className="text-[10px] uppercase font-extrabold text-[#C89C76] tracking-wider mb-1">🎁 Quà tặng kèm</p>
                                 <h3 className="font-extrabold text-sm text-[#5F3D2E] leading-tight">Cảm ơn bạn đã mua hàng! Tặng bạn Voucher cho lần ghé thăm tiếp theo!</h3>
                                 
                                 {/* Dashed voucher code box */}
                                 <div className="my-4 py-3.5 px-5 bg-white border-2 border-dashed border-[#C89C76] rounded-2xl flex justify-between items-center gap-3">
                                    <div className="flex items-center gap-2">
                                       <span className="text-lg">🎫</span>
                                       <span className="font-mono font-extrabold text-brand-dark tracking-wide text-sm">{order.voucherCode || 'GOLDO2OFF'}</span>
                                    </div>
                                    <button 
                                       onClick={() => {
                                          navigator.clipboard.writeText(order.voucherCode || 'GOLDO2OFF');
                                          alert(`Đã sao chép mã Voucher ${order.voucherCode || 'GOLDO2OFF'} vào clipboard!`);
                                       }}
                                       className="px-4 py-2 bg-[#C89C76] hover:bg-[#b08865] text-white text-[10px] font-extrabold rounded-full shadow-sm active:scale-95 transition-all shrink-0"
                                    >
                                       Sao chép
                                    </button>
                                 </div>

                                 <p className="text-[10px] text-gray-400">※ Áp dụng cho hóa đơn từ 200k tại quầy POS.</p>
                              </div>
                           </div>

                           {/* Review & Feedback card */}
                           <div className="bg-emerald-50/50 border border-emerald-100 rounded-[24px] p-4 text-center shadow-soft">
                              <p className="text-xs font-extrabold text-emerald-800">🎉 Đơn hàng đã hoàn thành xuất sắc</p>
                              <p className="text-[10px] text-emerald-600 mt-1">Cảm ơn bạn đã lựa chọn ExpressCafe. Bạn thấy dịch vụ thế nào?</p>
                              <div className="flex justify-center gap-1.5 mt-2.5">
                                 {[1, 2, 3, 4, 5].map((star) => (
                                    <span 
                                       key={star} 
                                       onClick={() => alert(`Cảm ơn bạn đã đánh giá ${star} sao!`)}
                                       className="text-lg cursor-pointer hover:scale-125 transition-transform"
                                    >
                                       ⭐
                                    </span>
                                 ))}
                              </div>
                           </div>
                        </>
                     )}

                     {/* 4. If Cancelled: Show striking Cancelled warning card & Re-order option */}
                     {orderStatus === 'CANCELLED' && (
                        <div className="bg-red-50 border border-red-100/50 rounded-[24px] p-5 shadow-soft text-center">
                           <span className="text-3xl">❌</span>
                           <h4 className="font-extrabold text-red-800 text-sm mt-2">Đơn hàng đã bị hủy bỏ</h4>
                           <p className="text-[11px] text-red-600/80 mt-1 leading-relaxed">
                              {order.errorMessage || 'Đơn hàng này đã bị hủy bỏ bởi hệ thống hoặc theo yêu cầu của quý khách. Xin lỗi vì sự bất tiện này!'}
                           </p>
                           <button 
                              onClick={() => {
                                 window.location.href = '/';
                              }}
                              className="mt-3.5 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-full shadow-sm active:scale-95 transition-all w-full"
                           >
                              Quay lại Menu đặt lại đơn
                           </button>
                        </div>
                     )}
                     
                     <div className="space-y-3 mt-4">
                        <p className="font-extrabold text-brand-dark text-xs uppercase tracking-wider text-gray-400">Danh sách món đặt:</p>
                        <div className="space-y-3">
                          {parsedItems.map((item: any, idx: number) => {
                             const itemImage = item.image ? api.getMediaUrl(item.image) : '';
                             const itemPrice = item.price || item.unitPrice || 0;
                             
                             return (
                               <div key={idx} className="flex items-center gap-3 bg-brand-cream/30 p-2.5 rounded-2xl border border-gray-50">
                                 {/* Thumbnail ảnh sản phẩm */}
                                 <div className="w-14 h-14 bg-white rounded-xl overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                                     {itemImage ? (
                                         <img src={itemImage} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Mon' }} />
                                     ) : (
                                         <div className="w-full h-full bg-orange-50 flex items-center justify-center text-brand-primary">★</div>
                                     )}
                                 </div>
                                 
                                 {/* Thông tin sản phẩm */}
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-1.5">
                                      <p className="font-extrabold text-brand-dark text-xs truncate">{item.name || `Sản phẩm #${item.externalProductId || item.productId}`}</p>
                                      {item.productId && (String(item.productId).startsWith('nh_') || String(item.productId).startsWith('hv_')) && (
                                         <span className="px-1 py-0.5 rounded text-[8px] font-extrabold text-white bg-purple-600">HARAVAN</span>
                                      )}
                                   </div>
                                   
                                   {/* Options: Size & Milk */}
                                   {(item.size || item.milkLevel) && (
                                       <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                                           Size: {item.size || 'M'} &middot; Sữa: {item.milkLevel || 50}%
                                       </p>
                                   )}
                                   
                                   <p className="text-[10px] text-brand-coffee font-extrabold mt-1">
                                       {itemPrice.toLocaleString('vi-VN')}đ
                                   </p>
                                 </div>
                                 
                                 {/* Số lượng & Thành tiền */}
                                 <div className="text-right shrink-0">
                                   <p className="text-xs font-extrabold text-brand-dark">x{item.quantity}</p>
                                   <p className="text-xs font-extrabold text-brand-dark mt-1">
                                       {(itemPrice * item.quantity).toLocaleString('vi-VN')}đ
                                   </p>
                                 </div>
                                </div>
                             );
                          })}
                        </div>
                     </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
};