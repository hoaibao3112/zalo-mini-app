import React, { useEffect, useState } from 'react';
import { Clock, Package, CheckCircle, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
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
                  <div className="mt-2 pt-3 border-t border-gray-50 text-sm text-gray-600 space-y-4 animate-fade-in">
                     {order.externalOrderId && (
                         <p className="text-xs">
                             <span className="font-medium text-gray-500">Mã đơn sàn liên kết:</span>{" "}
                             <span className="font-bold text-brand-dark">{order.externalOrderId}</span>
                         </p>
                     )}
                     
                     <div className="space-y-3">
                        <p className="font-semibold text-brand-dark text-xs uppercase tracking-wider text-gray-400">Danh sách món đặt:</p>
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
                                   <p className="font-bold text-brand-dark text-xs truncate">{item.name || `Sản phẩm #${item.externalProductId || item.productId}`}</p>
                                   
                                   {/* Options: Size & Milk */}
                                   {(item.size || item.milkLevel) && (
                                       <p className="text-[10px] text-gray-400 mt-0.5">
                                           Size: {item.size || 'M'} &middot; Sữa: {item.milkLevel || 50}%
                                       </p>
                                   )}
                                   
                                   <p className="text-[10px] text-brand-primary font-semibold mt-1">
                                       {itemPrice.toLocaleString('vi-VN')}đ
                                   </p>
                                 </div>
                                 
                                 {/* Số lượng & Thành tiền */}
                                 <div className="text-right shrink-0">
                                   <p className="text-xs font-bold text-brand-dark">x{item.quantity}</p>
                                   <p className="text-xs font-bold text-brand-dark mt-1">
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