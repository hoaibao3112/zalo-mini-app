import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trash2, Minus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useSnackbar } from 'zmp-ui';

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { openSnackbar } = useSnackbar();

  // Form state
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    street: ''
  });
  const [formError, setFormError] = useState('');

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
  const shipping = 0; // Free shipping
  const total = subtotal + shipping;

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    
    // Validate form
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.province || !customerInfo.district || !customerInfo.ward || !customerInfo.street) {
      setFormError('Vui lòng nhập đầy đủ thông tin giao hàng!');
      document.getElementById('shipping-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
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

      const provinceName = customerInfo.province.split('|')[1];
      const districtName = customerInfo.district.split('|')[1];
      const wardName = customerInfo.ward.split('|')[1];
      const fullAddress = `${customerInfo.street}, ${wardName}, ${districtName}, ${provinceName}`;

      // Nhóm các sản phẩm trong giỏ hàng theo Platform (LOCAL, NHANH hoặc HARAVAN)
      // Đảm bảo nếu khách hàng mua nhiều sản phẩm cùng hệ thống sẽ gộp thành 1 đơn duy nhất
      const itemsByPlatform: Record<string, typeof cartItems> = {};
      cartItems.forEach(item => {
          let platform = 'LOCAL';
          // Nếu có externalId thì chắc chắn là sản phẩm E-commerce liên kết
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

      // Tạo các yêu cầu đặt hàng gộp (Consolidated Orders) tương ứng với từng platform
      const checkoutPromises = Object.keys(itemsByPlatform).map(platform => {
          const platformItems = itemsByPlatform[platform];
          
          if (platform === 'LOCAL') {
              // 1. Đối với sản phẩm Local (Espresso, Americano...): Tạo đơn hàng nội bộ
              const totalAmount = platformItems.reduce((sum, item) => sum + (item.salePrice || item.price) * item.quantity, 0);
              
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
                  total: totalAmount
              }).then(res => {
                  if (!res || res.error || res.success === false) {
                      throw new Error(res?.message || res?.error || 'Lỗi đặt hàng sản phẩm local');
                  }
                  return res;
              });
          } else {
              // 2. Đối với sản phẩm E-commerce (Nhanh.vn / Haravan): Đẩy lên máy chủ sàn liên kết
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
                }
              }).then(res => {
                if (!res || res.error || res.success === false) {
                  throw new Error(res?.message || res?.error || 'Lỗi đặt hàng từ máy chủ e-commerce');
                }
                return res;
              });
          }
      });

      await Promise.all(checkoutPromises);
      openSnackbar({ text: 'Đặt hàng thành công!', type: 'success' });
      clearCart();
      navigate('/orders');
    } catch(err: any) {
      console.error('Checkout error:', err);
      openSnackbar({ text: err.message || 'Đặt hàng thất bại. Vui lòng thử lại!', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  };

  return (
    <div className="flex flex-col h-full bg-brand-cream font-sans relative">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center z-10 sticky top-0 bg-brand-cream/90 backdrop-blur-md">
        <button 
            onClick={() => navigate(-1)}
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-brand-dark shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronLeft size={24} strokeWidth={2.5} className="-ml-1" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-brand-dark mr-11">Giỏ hàng</h1>
      </div>

      {/* Cart Items List & Form */}
      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-64 space-y-4 no-scrollbar">
         {cartItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-center">
                 <div className="w-24 h-24 bg-brand-light rounded-full flex items-center justify-center mb-4">
                    <Trash2 size={32} className="text-brand-primary opacity-50" />
                 </div>
                 <h3 className="text-lg font-bold text-brand-dark mb-1">Giỏ hàng trống</h3>
                 <p className="text-gray-400 text-sm mb-6">Hãy thêm một vài thức uống ngon nhé!</p>
                 <button onClick={() => navigate('/')} className="px-8 py-3 bg-brand-dark text-white rounded-full font-bold active:scale-95 transition-transform">
                    Khám phá menu
                 </button>
             </div>
         ) : (
            <>
               {/* Danh sách món */}
               <div className="space-y-4">
                 {cartItems.map((item) => (
                    <div key={item.cartId} className="bg-white rounded-[24px] p-4 flex items-center shadow-soft border border-gray-50 relative group">
                        <div className="w-20 h-20 rounded-[16px] overflow-hidden mr-4 flex-shrink-0 bg-brand-light">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        
                        <div className="flex-1 min-w-0 pr-2">
                            <h3 className="font-bold text-brand-dark text-[15px] leading-tight mb-1 truncate">{item.name}</h3>
                            <p className="text-xs text-gray-400 mb-2 truncate">Size {item.size} • {item.milkLevel}% Sữa</p>
                            <p className="text-brand-primary font-bold">{(item.salePrice || item.price).toLocaleString()}đ</p>
                        </div>

                        <div className="flex flex-col items-end gap-3 justify-between h-full">
                           <button 
                              onClick={() => removeFromCart(item.cartId)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                           >
                             <Trash2 size={16} />
                           </button>

                           <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100">
                              <button 
                                onClick={() => item.quantity > 1 ? updateQuantity(item.cartId, item.quantity - 1) : removeFromCart(item.cartId)}
                                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-brand-dark shadow-sm active:scale-90 transition-transform"
                              >
                                 <Minus size={14} strokeWidth={2.5} />
                              </button>
                              <span className="text-sm font-extrabold text-brand-dark w-6 text-center">{item.quantity}</span>
                              <button 
                                 onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                                 className="w-7 h-7 flex items-center justify-center bg-brand-dark text-white rounded-lg shadow-sm active:scale-90 transition-transform"
                              >
                                 <Plus size={14} strokeWidth={2.5} />
                              </button>
                           </div>
                        </div>
                    </div>
                 ))}
               </div>

               {/* Form Thông tin giao hàng */}
               <div id="shipping-form" className="mt-8 bg-white rounded-[24px] p-5 shadow-soft border border-gray-50">
                  <h3 className="font-bold text-brand-dark text-lg mb-4">Thông tin giao hàng</h3>
                  {formError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-500 rounded-xl text-sm font-medium">
                       {formError}
                    </div>
                  )}
                  <div className="space-y-4">
                     <div>
                       <label className="block text-sm text-gray-500 font-medium mb-1">Họ tên người nhận <span className="text-red-400">*</span></label>
                       <input 
                         type="text" name="name" value={customerInfo.name} onChange={handleInputChange}
                         placeholder="Nhập họ tên" 
                         className="w-full bg-brand-cream h-12 rounded-xl px-4 text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                       />
                     </div>
                     <div>
                       <label className="block text-sm text-gray-500 font-medium mb-1">Số điện thoại <span className="text-red-400">*</span></label>
                       <input 
                         type="tel" name="phone" value={customerInfo.phone} onChange={handleInputChange}
                         placeholder="Nhập số điện thoại (10 số)" maxLength={10}
                         className="w-full bg-brand-cream h-12 rounded-xl px-4 text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                       />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm text-gray-500 font-medium mb-1">Tỉnh / Thành phố <span className="text-red-400">*</span></label>
                           <select 
                             name="province" value={customerInfo.province} onChange={handleProvinceChange}
                             className="w-full bg-brand-cream h-12 rounded-xl px-3 text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none"
                           >
                             <option value="" disabled>Chọn Tỉnh/Thành</option>
                             {provinces.map((p: any) => (
                               <option key={p.code} value={`${p.code}|${p.name}`}>{p.name}</option>
                             ))}
                           </select>
                        </div>
                        <div>
                           <label className="block text-sm text-gray-500 font-medium mb-1">Quận / Huyện <span className="text-red-400">*</span></label>
                           <select 
                             name="district" value={customerInfo.district} onChange={handleDistrictChange} disabled={!customerInfo.province}
                             className="w-full bg-brand-cream h-12 rounded-xl px-3 text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none disabled:opacity-50"
                           >
                             <option value="" disabled>Chọn Quận/Huyện</option>
                             {districts.map((d: any) => (
                               <option key={d.code} value={`${d.code}|${d.name}`}>{d.name}</option>
                             ))}
                           </select>
                        </div>
                     </div>

                     <div>
                       <label className="block text-sm text-gray-500 font-medium mb-1">Phường / Xã <span className="text-red-400">*</span></label>
                       <select 
                         name="ward" value={customerInfo.ward} onChange={handleWardChange} disabled={!customerInfo.district}
                         className="w-full bg-brand-cream h-12 rounded-xl px-4 text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none disabled:opacity-50"
                       >
                         <option value="" disabled>Chọn Phường/Xã</option>
                         {wards.map((w: any) => (
                           <option key={w.code} value={`${w.code}|${w.name}`}>{w.name}</option>
                         ))}
                       </select>
                     </div>

                     <div>
                       <label className="block text-sm text-gray-500 font-medium mb-1">Số nhà, Tên đường <span className="text-red-400">*</span></label>
                       <input 
                         type="text" name="street" value={customerInfo.street} onChange={handleInputChange}
                         placeholder="Ví dụ: 123 Lê Lợi..." 
                         className="w-full bg-brand-cream h-12 rounded-xl px-4 text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                       />
                     </div>
                  </div>
               </div>
            </>
         )}
      </div>

      {/* Floating Checkout Card */}
      {cartItems.length > 0 && (
        <div className="absolute bottom-6 left-6 right-6 bg-brand-dark rounded-[32px] p-6 shadow-float z-20">
            <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-400 text-sm font-medium">
                    <span>Tạm tính</span>
                    <span className="text-white">{subtotal.toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between text-gray-400 text-sm font-medium">
                    <span>Phí giao hàng</span>
                    <span className="text-white">Miễn phí</span>
                </div>
                <div className="h-[1px] w-full bg-white/10 my-1"></div>
                <div className="flex justify-between text-white font-bold text-lg items-end">
                    <span>Tổng cộng</span>
                    <span className="text-2xl text-brand-primary">{total.toLocaleString()}đ</span>
                </div>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-brand-primary py-4 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100 shadow-[0_4px_15px_rgba(255,107,0,0.3)]"
            >
                {loading ? 'Đang xử lý...' : 'Thanh toán ngay'}
            </button>
        </div>
      )}
    </div>
  );
};