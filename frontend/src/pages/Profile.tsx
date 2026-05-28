import { User, CreditCard, Settings, LogOut, ChevronRight, MapPin, Bell, HelpCircle, LogIn } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';

import { api } from '../lib/api';

const MENU_ITEMS = [
    { icon: User, label: 'Thông tin cá nhân' },
    { icon: MapPin, label: 'Địa chỉ giao hàng' },
    { icon: CreditCard, label: 'Phương thức thanh toán' },
    { icon: Bell, label: 'Thông báo' },
    { icon: HelpCircle, label: 'Trợ giúp & Hỗ trợ' },
    { icon: Settings, label: 'Cài đặt' },
];

export const Profile = () => {
    const { user, isLoggedIn, isLoading, login, logout } = useAuth();

    async function handleLogin() {
        try {
            await login();
        } catch (error) {
            console.error('Đăng nhập thất bại:', error);
        }
    }

    function handleLogout() {
        logout();
    }

    if (isLoading) {
        return (
            <div className="flex flex-col h-full bg-brand-cream items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-primary border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-brand-cream">
            {/* Top Section */}
            <div className="relative pt-12 pb-8 px-6 flex flex-col items-center z-10">
                <h1 className="text-xl font-bold text-brand-dark mb-6 w-full text-left">Hồ Sơ</h1>

                {isLoggedIn && user ? (
                    <>
                        <div className="relative">
                            <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                <img
                                    src={api.getMediaUrl(user.avatar) || 'https://placehold.co/150x150?text=Avatar'}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://placehold.co/150x150?text=Avatar';
                                    }}
                                />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-brand-dark mt-4">{user.name}</h2>
                        <p className="text-brand-gray text-sm">
                            Zalo: {user.zaloId ? `${user.zaloId.substring(0, 10)}...` : 'Tài khoản thử nghiệm'}
                        </p>
                    </>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden mx-auto bg-gray-100 flex items-center justify-center">
                            <User size={48} className="text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold text-brand-dark mt-4">Chưa đăng nhập</h2>
                        <p className="text-brand-gray text-sm mb-4">Đăng nhập để sử dụng đầy đủ tính năng</p>
                        <button
                            onClick={handleLogin}
                            className="bg-brand-primary text-white px-6 py-3 rounded-full font-semibold flex items-center space-x-2 mx-auto"
                        >
                            <LogIn size={20} />
                            <span>Đăng nhập với Zalo</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Menu List - chỉ hiển thị khi đã đăng nhập */}
            {isLoggedIn && (
                <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
                    <div className="flex flex-col space-y-4">
                        {MENU_ITEMS.map((item, index) => (
                            <button key={index} className="flex items-center justify-between p-4 bg-white rounded-[20px] shadow-sm group hover:shadow-md transition-all active:scale-[0.98]">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                        <item.icon size={20} />
                                    </div>
                                    <span className="font-bold text-brand-dark">{item.label}</span>
                                </div>
                                <ChevronRight size={20} className="text-gray-300 group-hover:text-brand-primary" />
                            </button>
                        ))}

                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-between p-4 bg-white/50 rounded-[20px] border border-transparent mt-4 hover:bg-red-50 hover:border-red-100 transition-all group"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                                    <LogOut size={20} />
                                </div>
                                <span className="font-bold text-gray-500 group-hover:text-red-500">Đăng xuất</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    );
};