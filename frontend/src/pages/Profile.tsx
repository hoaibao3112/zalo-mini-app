import React, { useState, useEffect } from 'react';
import { User, CreditCard, Settings, LogOut, ChevronRight, MapPin, Bell, HelpCircle, LogIn, Phone, MessageSquare, Gift, Award, Sparkles, Copy, Check, Save, X, Eye, Languages } from 'lucide-react';
import { BottomNav } from '../components/layout/BottomNav';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import * as zmpSdk from 'zmp-sdk';
import { useTranslation } from 'react-i18next';

// SVG Barcode Component
const MemberBarcode = ({ value }: { value: string }) => {
    return (
        <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl shadow-sm border border-gray-100 w-full">
            <svg className="w-full h-12" viewBox="0 0 100 24" preserveAspectRatio="none">
                <rect x="0" y="0" width="100" height="24" fill="white" />
                {/* Simulated high-quality barcode stripes */}
                <rect x="4" y="2" width="1.5" height="20" fill="black" />
                <rect x="7" y="2" width="0.75" height="20" fill="black" />
                <rect x="9" y="2" width="2.25" height="20" fill="black" />
                <rect x="13" y="2" width="0.75" height="20" fill="black" />
                <rect x="15" y="2" width="1.5" height="20" fill="black" />
                <rect x="18" y="2" width="0.75" height="20" fill="black" />
                <rect x="20" y="2" width="2.25" height="20" fill="black" />
                <rect x="24" y="2" width="1.5" height="20" fill="black" />
                <rect x="27" y="2" width="0.75" height="20" fill="black" />
                <rect x="29" y="2" width="2.25" height="20" fill="black" />
                <rect x="33" y="2" width="0.75" height="20" fill="black" />
                <rect x="35" y="2" width="1.5" height="20" fill="black" />
                <rect x="38" y="2" width="0.75" height="20" fill="black" />
                <rect x="40" y="2" width="2.25" height="20" fill="black" />
                <rect x="44" y="2" width="1.5" height="20" fill="black" />
                <rect x="47" y="2" width="0.75" height="20" fill="black" />
                <rect x="49" y="2" width="2.25" height="20" fill="black" />
                <rect x="53" y="2" width="0.75" height="20" fill="black" />
                <rect x="55" y="2" width="1.5" height="20" fill="black" />
                <rect x="58" y="2" width="0.75" height="20" fill="black" />
                <rect x="60" y="2" width="2.25" height="20" fill="black" />
                <rect x="64" y="2" width="1.5" height="20" fill="black" />
                <rect x="67" y="2" width="0.75" height="20" fill="black" />
                <rect x="69" y="2" width="2.25" height="20" fill="black" />
                <rect x="73" y="2" width="0.75" height="20" fill="black" />
                <rect x="75" y="2" width="1.5" height="20" fill="black" />
                <rect x="78" y="2" width="0.75" height="20" fill="black" />
                <rect x="80" y="2" width="2.25" height="20" fill="black" />
                <rect x="84" y="2" width="1.5" height="20" fill="black" />
                <rect x="87" y="2" width="0.75" height="20" fill="black" />
                <rect x="89" y="2" width="2.25" height="20" fill="black" />
                <rect x="93" y="2" width="0.75" height="20" fill="black" />
                <rect x="95" y="2" width="1.5" height="20" fill="black" />
            </svg>
            <span className="text-[10px] tracking-widest text-brand-dark mt-1.5 font-mono font-bold select-all">{value}</span>
        </div>
    );
};

export const Profile = () => {
    const { user, isLoggedIn, isLoading: isAuthLoading, login, logout, updateUser } = useAuth();
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language || 'vi';
    
    // UI State
    const [localUser, setLocalUser] = useState<any>(null);
    const [credits, setCredits] = useState<{ balance: number; totalEarned: number } | null>(null);
    const [vouchers, setVouchers] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Collapsible / Modal Tabs
    const [activeTab, setActiveTab] = useState<string | null>(null); // 'address' | 'vouchers' | 'barcode'
    const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [posScanning, setPosScanning] = useState(false);

    // Address Form State
    const [addressForm, setAddressForm] = useState({
        name: '',
        phone: '',
        address: '',
        city: '',
        district: '',
        ward: ''
    });

    // Geographic data states
    const [provinces, setProvinces] = useState<any[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    const [wards, setWards] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'address') {
            fetch('https://provinces.open-api.vn/api/p/')
                .then(res => res.json())
                .then(data => setProvinces(data))
                .catch(err => console.error('Failed to load provinces', err));
        }
    }, [activeTab]);

    const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) return;
        const [code, name] = val.split('|');
        setAddressForm(prev => ({ ...prev, city: name, district: '', ward: '' }));
        setDistricts([]);
        setWards([]);
        fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`)
            .then(res => res.json())
            .then(data => setDistricts(data.districts || []))
            .catch(err => console.error('Failed to load districts', err));
    };

    const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) return;
        const [code, name] = val.split('|');
        setAddressForm(prev => ({ ...prev, district: name, ward: '' }));
        setWards([]);
        fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`)
            .then(res => res.json())
            .then(data => setWards(data.wards || []))
            .catch(err => console.error('Failed to load wards', err));
    };

    const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) return;
        const [, name] = val.split('|');
        setAddressForm(prev => ({ ...prev, ward: name }));
    };

    useEffect(() => {
        if (user) {
            setLocalUser(user);
            setAddressForm({
                name: user.name || '',
                phone: user.phone || '',
                address: (user as any).address || '',
                city: (user as any).city || '',
                district: (user as any).district || '',
                ward: (user as any).ward || ''
            });
            fetchLoyaltyData(user.id);
        } else {
            setLocalUser(null);
            setCredits(null);
            setVouchers([]);
        }
    }, [user]);

    // Play Beep sound using browser AudioContext API
    const playBeepSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, ctx.currentTime); // 1000Hz beep
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12); // fade out
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {
            console.warn("Browser block AudioContext initial beep", e);
        }
    };

    const fetchLoyaltyData = async (customerId: string) => {
        setLoadingData(true);
        try {
            const [creditsRes, vouchersRes] = await Promise.all([
                api.getSpinCredits(customerId),
                api.getSpinRewards(customerId, 'PENDING')
            ]);
            
            if (creditsRes) setCredits(creditsRes);
            
            // Check list or cursor format from API
            if (vouchersRes) {
                const voucherList = Array.isArray(vouchersRes) ? vouchersRes : (vouchersRes.items || []);
                setVouchers(voucherList);
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu loyalty:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const getMemberTier = (totalEarned: number = 0) => {
        if (totalEarned < 100) {
            return {
                name: 'Bronze',
                label: 'Thành viên Đồng',
                icon: '🥉',
                cardBg: 'linear-gradient(135deg, #a770ef 0%, #cf8bf3 50%, #fdb99b 100%)',
                color: 'text-purple-100',
                nextTier: 'Bạc',
                nextPoints: 100,
                progress: Math.min((totalEarned / 100) * 100, 100),
                bgGlow: 'rgba(167, 112, 239, 0.15)'
            };
        } else if (totalEarned < 300) {
            return {
                name: 'Silver',
                label: 'Thành viên Bạc',
                icon: '🥈',
                cardBg: 'linear-gradient(135deg, #757f9a 0%, #d7dde8 100%)',
                color: 'text-slate-200',
                nextTier: 'Vàng',
                nextPoints: 300,
                progress: Math.min(((totalEarned - 100) / 200) * 100, 100),
                bgGlow: 'rgba(117, 127, 154, 0.15)'
            };
        } else if (totalEarned < 1000) {
            return {
                name: 'Gold',
                label: 'Thành viên Vàng',
                icon: '🥇',
                cardBg: 'linear-gradient(135deg, #E2B056 0%, #F5D77F 40%, #C49132 80%, #A3701E 100%)',
                color: 'text-amber-100',
                nextTier: 'Kim Cương',
                nextPoints: 1000,
                progress: Math.min(((totalEarned - 300) / 700) * 100, 100),
                bgGlow: 'rgba(226, 176, 86, 0.2)'
            };
        } else {
            return {
                name: 'Diamond',
                label: 'Thành viên Kim Cương',
                icon: '💎',
                cardBg: 'linear-gradient(135deg, #1A2980 0%, #26D0CE 100%)',
                color: 'text-cyan-100',
                nextTier: 'Tối đa',
                nextPoints: 1000,
                progress: 100,
                bgGlow: 'rgba(38, 208, 206, 0.2)'
            };
        }
    };

    const tier = getMemberTier(credits?.totalEarned || 0);

    const handleCopyId = () => {
        if (!localUser?.id) return;
        navigator.clipboard.writeText(localUser.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleChatOA = async () => {
        const oaId = (import.meta as any).env.VITE_OA_ID || '123456789012345678';
        try {
            if (zmpSdk && (zmpSdk as any).openChat) {
                await (zmpSdk as any).openChat({ id: oaId });
            } else {
                window.open(`https://zalo.me/${oaId}`, '_blank');
            }
        } catch (e) {
            window.open(`https://zalo.me/${oaId}`, '_blank');
        }
    };

    const handleCallHotline = async () => {
        const phone = '19001234';
        try {
            if (zmpSdk && (zmpSdk as any).openPhone) {
                await (zmpSdk as any).openPhone({ phoneNumber: phone });
            } else {
                window.open(`tel:${phone}`, '_self');
            }
        } catch (e) {
            window.open(`tel:${phone}`, '_self');
        }
    };

    const handleLogin = async () => {
        try {
            await login();
        } catch (error) {
            console.error('Đăng nhập thất bại:', error);
        }
    };

    const handleSaveAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!localUser?.id) return;
        
        setIsSavingAddress(true);
        try {
            const res = await api.updateCustomer(localUser.id, addressForm);
            
            // Check exact merge response or clean customer object
            const updatedCustomer = res?.customer || res;
            if (updatedCustomer && updatedCustomer.id) {
                setLocalUser(updatedCustomer);
                if (updateUser) {
                    updateUser(updatedCustomer);
                }
                alert('Cập nhật địa chỉ nhận hàng thành công!');
                setActiveTab(null);
            } else {
                throw new Error('Không nhận được dữ liệu phản hồi đúng');
            }
        } catch (error) {
            console.error('Lỗi khi lưu địa chỉ:', error);
            alert('Có lỗi xảy ra khi lưu địa chỉ. Vui lòng thử lại!');
        } finally {
            setIsSavingAddress(false);
        }
    };

    const handleSimulatePOS = async (rewardId: string) => {
        setPosScanning(true);
        playBeepSound();
        try {
            // Call API useSpinReward to update PENDING -> USED
            await api.useSpinReward(rewardId);
            
            alert('Quét POS thành công! Voucher của bạn đã được sử dụng.');
            setSelectedVoucher(null);
            if (localUser?.id) {
                fetchLoyaltyData(localUser.id);
            }
        } catch (error) {
            console.error('POS scan fail:', error);
            alert('Không thể sử dụng voucher, vui lòng kiểm tra lại!');
        } finally {
            setPosScanning(false);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="flex flex-col h-full bg-brand-cream items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-primary border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-brand-cream">
            {/* Global Keyframes CSS for scan animation */}
            <style>{`
                @keyframes laser {
                    0%, 100% { top: 0%; opacity: 0.8; }
                    50% { top: 100%; opacity: 0.8; }
                }
                .animate-laser {
                    animation: laser 2s infinite linear;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* Top Page Title */}
            <div className="pt-8 px-6 flex justify-between items-center z-10 shrink-0">
                <h1 className="text-2xl font-black text-brand-dark">Hồ Sơ Thành Viên</h1>
                {isLoggedIn && localUser && (
                    <button 
                        onClick={logout}
                        className="text-[11px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center space-x-1"
                    >
                        <LogOut size={12} />
                        <span>Đăng xuất</span>
                    </button>
                )}
            </div>

            {isLoggedIn && localUser ? (
                <div className="flex-1 overflow-y-auto px-6 pb-28 pt-4 no-scrollbar space-y-5">
                    {/* User profile card & Loyalty tiers */}
                    <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100/50">
                        <div className="w-16 h-16 rounded-full border-2 border-white ring-4 ring-brand-primary/10 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                            <img
                                src={api.getMediaUrl(localUser.avatar) || 'https://placehold.co/150x150?text=Avatar'}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/150x150?text=Avatar';
                                }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-black text-brand-dark truncate">{localUser.name}</h2>
                            <p className="text-[11px] font-bold text-brand-primary/80 mt-0.5 truncate flex items-center space-x-1">
                                <Sparkles size={11} className="animate-pulse" />
                                <span>{tier.label}</span>
                            </p>
                            <div className="flex items-center mt-1 text-[10px] text-gray-400 font-mono">
                                <span className="truncate max-w-[120px]">ID: {localUser.id}</span>
                                <button 
                                    onClick={handleCopyId}
                                    className="ml-1 p-1 hover:bg-gray-100 rounded text-brand-primary transition-colors active:scale-90"
                                >
                                    {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ROYAL MEMBERSHIP CARD */}
                    <div 
                        style={{ background: tier.cardBg }}
                        className="relative p-6 rounded-[24px] shadow-lg text-white flex flex-col justify-between h-48 overflow-hidden group select-none active:scale-[0.99] transition-transform"
                    >
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                        
                        {/* Glow ambient */}
                        <div className="absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-50" style={{ backgroundColor: tier.bgGlow }}></div>
                        
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest font-black text-white/70">Thẻ Thành Viên</span>
                                <h3 className="text-2xl font-black italic tracking-wide mt-0.5">{tier.name} Tier</h3>
                            </div>
                            <span className="text-3xl filter drop-shadow-md">{tier.icon}</span>
                        </div>

                        {/* Middle: Barcode strip */}
                        <div 
                            onClick={() => setActiveTab('barcode')}
                            className="bg-white/95 text-brand-dark p-2 rounded-xl flex items-center justify-between cursor-pointer active:scale-95 transition-all shadow-md z-10 mt-1 hover:bg-white"
                        >
                            <div className="w-4/5 shrink-0 opacity-90">
                                <svg className="w-full h-8" viewBox="0 0 100 24" preserveAspectRatio="none">
                                    <rect x="3" y="2" width="1" height="20" fill="black" />
                                    <rect x="5" y="2" width="2" height="20" fill="black" />
                                    <rect x="8" y="2" width="1" height="20" fill="black" />
                                    <rect x="10" y="2" width="3" height="20" fill="black" />
                                    <rect x="14" y="2" width="1" height="20" fill="black" />
                                    <rect x="17" y="2" width="2" height="20" fill="black" />
                                    <rect x="20" y="2" width="1" height="20" fill="black" />
                                    <rect x="22" y="2" width="1" height="20" fill="black" />
                                    <rect x="24" y="2" width="3" height="20" fill="black" />
                                    <rect x="28" y="2" width="1" height="20" fill="black" />
                                    <rect x="30" y="2" width="2" height="20" fill="black" />
                                    <rect x="33" y="2" width="1" height="20" fill="black" />
                                    <rect x="36" y="2" width="2" height="20" fill="black" />
                                    <rect x="39" y="2" width="3" height="20" fill="black" />
                                    <rect x="43" y="2" width="1" height="20" fill="black" />
                                    <rect x="45" y="2" width="2" height="20" fill="black" />
                                    <rect x="48" y="2" width="1" height="20" fill="black" />
                                    <rect x="51" y="2" width="1" height="20" fill="black" />
                                    <rect x="53" y="2" width="3" height="20" fill="black" />
                                    <rect x="57" y="2" width="1" height="20" fill="black" />
                                    <rect x="59" y="2" width="2" height="20" fill="black" />
                                    <rect x="62" y="2" width="1" height="20" fill="black" />
                                    <rect x="64" y="2" width="2" height="20" fill="black" />
                                    <rect x="67" y="2" width="3" height="20" fill="black" />
                                    <rect x="71" y="2" width="1" height="20" fill="black" />
                                    <rect x="73" y="2" width="2" height="20" fill="black" />
                                    <rect x="76" y="2" width="1" height="20" fill="black" />
                                    <rect x="78" y="2" width="1" height="20" fill="black" />
                                    <rect x="80" y="2" width="3" height="20" fill="black" />
                                    <rect x="84" y="2" width="1" height="20" fill="black" />
                                    <rect x="86" y="2" width="2" height="20" fill="black" />
                                    <rect x="89" y="2" width="1" height="20" fill="black" />
                                    <rect x="91" y="2" width="2" height="20" fill="black" />
                                    <rect x="94" y="2" width="1" height="20" fill="black" />
                                </svg>
                            </div>
                            <div className="flex flex-col items-center justify-center pr-1 text-brand-primary">
                                <Eye size={16} />
                                <span className="text-[7px] font-bold uppercase mt-0.5">Phóng to</span>
                            </div>
                        </div>

                        {/* Bottom: points & progress */}
                        <div className="z-10 mt-2">
                            <div className="flex justify-between items-end text-xs">
                                <div>
                                    <span className="text-[10px] text-white/70 block">Đậu của tôi</span>
                                    <span className="text-xl font-black">{credits?.balance || 0} Đậu 🫘</span>
                                </div>
                                <div className="text-right text-[10px] text-white/80">
                                    {tier.name === 'Diamond' ? (
                                        <span>Cấp tối đa 🎉</span>
                                    ) : (
                                        <span>Tích lũy: {credits?.totalEarned || 0} / {tier.nextPoints} Đậu để lên {tier.nextTier}</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Shiny progress bar */}
                            <div className="w-full h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden shadow-inner">
                                <div 
                                    style={{ width: `${tier.progress}%` }}
                                    className="h-full bg-white rounded-full transition-all duration-500 shadow"
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* VOUCHER WALLET DASHBOARD */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100/50">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-black text-brand-dark flex items-center space-x-1.5">
                                <Gift size={16} className="text-brand-primary" />
                                <span>Ví Voucher Của Tôi ({vouchers.length})</span>
                            </h3>
                            <span className="text-[10px] bg-brand-soft text-brand-primary px-2.5 py-1 rounded-full font-bold">Quà trúng thưởng</span>
                        </div>

                        {loadingData ? (
                            <div className="py-8 flex justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-primary border-t-transparent"></div>
                            </div>
                        ) : vouchers.length > 0 ? (
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                                {vouchers.map((voucher) => (
                                    <div 
                                        key={voucher.id}
                                        className="flex bg-brand-cream/40 rounded-xl border border-brand-soft overflow-hidden h-20 group relative active:scale-[0.98] transition-all"
                                    >
                                        {/* Left stamp punch hole design */}
                                        <div className="w-16 bg-brand-primary/10 flex flex-col items-center justify-center border-r border-dashed border-brand-soft relative shrink-0">
                                            <Gift className="text-brand-primary w-5 h-5 shrink-0" />
                                            <span className="text-[8px] font-black text-brand-primary mt-1">GIFT</span>
                                            
                                            {/* Half circles to simulate coupon punch holes */}
                                            <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-brand-soft"></div>
                                            <div className="absolute bottom-0 right-0 transform translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-brand-soft"></div>
                                        </div>
                                        {/* Content info */}
                                        <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
                                            <div>
                                                <h4 className="text-[11px] font-black text-brand-dark truncate">{voucher.prizeName}</h4>
                                                <p className="text-[9px] font-bold text-gray-400 font-mono mt-0.5 truncate">CODE: {voucher.voucherCode || 'POS_AUTO_REWARDS'}</p>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] text-gray-400">Trúng ngày: {new Date(voucher.createdAt).toLocaleDateString('vi-VN')}</span>
                                                <button 
                                                    onClick={() => setSelectedVoucher(voucher)}
                                                    className="bg-brand-primary text-white text-[9px] font-black px-2.5 py-1 rounded-lg shadow-sm hover:bg-brand-primary/90 active:scale-95 transition-all"
                                                >
                                                    Sử dụng
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                <Gift className="mx-auto text-gray-300 mb-1" size={24} />
                                <p className="text-[11px] text-gray-400 font-bold">Bạn chưa sở hữu voucher nào</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">Quay thưởng tại vòng quay để săn quà nhé!</p>
                            </div>
                        )}
                    </div>

                    {/* PERSONAL INFORMATION & SHIPPING ADDRESS COLLAPSIBLE */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden">
                        <button
                            onClick={() => setActiveTab(activeTab === 'address' ? null : 'address')}
                            className="w-full flex items-center justify-between p-4 font-black text-brand-dark text-sm border-b border-gray-50 hover:bg-gray-50/50 active:bg-gray-100/40 transition-colors"
                        >
                            <span className="flex items-center space-x-2">
                                <MapPin size={16} className="text-brand-primary" />
                                <span>Quản lý địa chỉ giao hàng</span>
                            </span>
                            <ChevronRight 
                                size={16} 
                                className={`text-gray-300 transform transition-transform ${activeTab === 'address' ? 'rotate-90 text-brand-primary' : ''}`} 
                            />
                        </button>

                        {activeTab === 'address' && (
                            <form onSubmit={handleSaveAddress} className="p-4 bg-brand-cream/20 space-y-3.5 border-b border-gray-100">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark uppercase block mb-1">Người nhận *</label>
                                        <input
                                            type="text"
                                            required
                                            value={addressForm.name}
                                            onChange={(e) => setAddressForm({...addressForm, name: e.target.value})}
                                            className="w-full p-2.5 text-xs bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none transition-colors"
                                            placeholder="Họ và tên"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark uppercase block mb-1">Số điện thoại *</label>
                                        <input
                                            type="tel"
                                            required
                                            value={addressForm.phone}
                                            onChange={(e) => setAddressForm({...addressForm, phone: e.target.value})}
                                            className="w-full p-2.5 text-xs bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none transition-colors"
                                            placeholder="SĐT 10 số"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-brand-dark uppercase block mb-1">Địa chỉ cụ thể *</label>
                                    <input
                                        type="text"
                                        required
                                        value={addressForm.address}
                                        onChange={(e) => setAddressForm({...addressForm, address: e.target.value})}
                                        className="w-full p-2.5 text-xs bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none transition-colors"
                                        placeholder="Số nhà, tên đường, tên tòa nhà..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark uppercase block mb-1">Tỉnh/Thành phố *</label>
                                        <select
                                            required
                                            value={addressForm.city ? `0|${addressForm.city}` : ''}
                                            onChange={handleProvinceChange}
                                            className="w-full p-2.5 text-xs bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none transition-colors font-sans"
                                        >
                                            <option value="" disabled>{addressForm.city || 'Chọn Tỉnh/Thành'}</option>
                                            {provinces.map((p: any) => (
                                                <option key={p.code} value={`${p.code}|${p.name}`}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-brand-dark uppercase block mb-1">Quận/Huyện *</label>
                                        <select
                                            required
                                            disabled={!addressForm.city && districts.length === 0}
                                            value={addressForm.district ? `0|${addressForm.district}` : ''}
                                            onChange={handleDistrictChange}
                                            className="w-full p-2.5 text-xs bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none transition-colors disabled:opacity-50 font-sans"
                                        >
                                            <option value="" disabled>{addressForm.district || 'Chọn Quận/Huyện'}</option>
                                            {districts.map((d: any) => (
                                                <option key={d.code} value={`${d.code}|${d.name}`}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-brand-dark uppercase block mb-1">Phường/Xã *</label>
                                    <select
                                        required
                                        disabled={!addressForm.district && wards.length === 0}
                                        value={addressForm.ward ? `0|${addressForm.ward}` : ''}
                                        onChange={handleWardChange}
                                        className="w-full p-2.5 text-xs bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:outline-none transition-colors disabled:opacity-50 font-sans"
                                    >
                                        <option value="" disabled>{addressForm.ward || 'Chọn Phường/Xã'}</option>
                                        {wards.map((w: any) => (
                                            <option key={w.code} value={`${w.code}|${w.name}`}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex space-x-2 pt-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab(null)}
                                        className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 bg-white active:scale-95 transition-all"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingAddress}
                                        className="px-5 py-2 bg-brand-primary text-white rounded-xl text-xs font-black shadow-sm flex items-center space-x-1.5 hover:bg-brand-primary/95 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        <Save size={12} />
                                        <span>{isSavingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}</span>
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* QUICK BRAND ACTIONS */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 p-4 space-y-3">
                        <h3 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1 text-gray-400">Trợ giúp & Liên hệ nhanh</h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={handleChatOA}
                                className="flex flex-col items-center justify-center p-3.5 bg-brand-soft rounded-2xl border border-brand-soft hover:bg-brand-primary hover:text-white transition-all group active:scale-[0.97]"
                            >
                                <MessageSquare size={20} className="text-brand-primary group-hover:text-white mb-1.5 transition-colors" />
                                <span className="text-[11px] font-black text-brand-dark group-hover:text-white transition-colors">Chat Zalo OA</span>
                                <span className="text-[8px] text-gray-400 group-hover:text-white/80 transition-colors mt-0.5">Nhận hỗ trợ 24/7</span>
                            </button>

                            <button 
                                onClick={handleCallHotline}
                                className="flex flex-col items-center justify-center p-3.5 bg-brand-soft rounded-2xl border border-brand-soft hover:bg-brand-primary hover:text-white transition-all group active:scale-[0.97]"
                            >
                                <Phone size={20} className="text-brand-primary group-hover:text-white mb-1.5 transition-colors" />
                                <span className="text-[11px] font-black text-brand-dark group-hover:text-white transition-colors">Tổng đài hỗ trợ</span>
                                <span className="text-[8px] text-gray-400 group-hover:text-white/80 transition-colors mt-0.5">Gọi hotline 19001234</span>
                            </button>
                        </div>
                    </div>

                    {/* SYSTEM LANGUAGE SETTINGS CARD */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 p-4 space-y-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1 text-gray-400">{t('profile_language', 'Ngôn ngữ hệ thống')}</h3>
                        
                        <div className="flex bg-gray-50/50 rounded-2xl p-1 border border-gray-100">
                            <button
                                type="button"
                                onClick={() => i18n.changeLanguage('vi')}
                                className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                                    currentLang === 'vi' 
                                        ? 'bg-[#F6E1B7] text-[#E53E3E] shadow-sm font-black' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span>🇻🇳</span>
                                <span>Tiếng Việt</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => i18n.changeLanguage('en')}
                                className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                                    currentLang === 'en' 
                                        ? 'bg-[#F6E1B7] text-[#E53E3E] shadow-sm font-black' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span>🇺🇸</span>
                                <span>English</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
                    <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center mb-6">
                        <User size={48} className="text-gray-400" />
                    </div>
                    <h2 className="text-xl font-black text-brand-dark text-center">Chào Bạn Mới! 👋</h2>
                    <p className="text-brand-gray text-xs text-center max-w-xs mt-2 mb-6 leading-relaxed">
                        Đăng nhập bằng Zalo để tạo Thẻ Thành Viên, tích điểm Đậu đổi quà và sử dụng các Voucher trúng giải từ vòng quay may mắn!
                    </p>
                    <button
                        onClick={handleLogin}
                        className="bg-brand-primary text-white font-black px-8 py-3.5 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center space-x-2 w-full max-w-xs justify-center"
                    >
                        <LogIn size={20} />
                        <span>Đăng nhập ngay</span>
                    </button>
                </div>
            )}

            {/* MEMBER BARCODE ZOOM MODAL */}
            {activeTab === 'barcode' && isLoggedIn && localUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-all duration-300 animate-fadeIn">
                    <div className="bg-white rounded-[28px] p-6 w-full max-w-sm flex flex-col items-center relative shadow-2xl animate-scaleUp">
                        {/* Header */}
                        <div className="flex justify-between items-center w-full mb-6 border-b border-gray-100 pb-3">
                            <span className="text-xs font-black text-brand-dark flex items-center space-x-1">
                                <Award size={14} className="text-brand-primary" />
                                <span>Thẻ Thành Viên ({tier.label})</span>
                            </span>
                            <button 
                                onClick={() => setActiveTab(null)}
                                className="text-gray-400 hover:text-brand-dark p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* QR scanner representation */}
                        <div className="relative w-full border border-gray-100 bg-gray-50/50 p-4 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden mb-6">
                            {/* Glowing Laser Scan Line */}
                            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] z-10 animate-laser"></div>
                            
                            {/* Realistic SVG Barcode inside scanned frame */}
                            <MemberBarcode value={localUser.id} />
                        </div>

                        {/* Scanner hint */}
                        <p className="text-xs text-gray-500 text-center font-bold px-2 leading-relaxed">
                            Đưa mã này cho nhân viên tại quầy POS để được tích điểm Đậu 🫘 hoặc quy đổi các đặc quyền hoàng gia!
                        </p>
                        
                        <button
                            onClick={() => setActiveTab(null)}
                            className="mt-6 w-full py-3 bg-brand-primary text-white font-black rounded-2xl shadow-md active:scale-95 transition-all text-xs"
                        >
                            Hoàn tất
                        </button>
                    </div>
                </div>
            )}

            {/* VOUCHER DETAILS & MOCK POS SCAN MODAL */}
            {selectedVoucher && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
                    <div className="bg-white rounded-[28px] p-6 w-full max-w-sm flex flex-col items-center relative shadow-2xl animate-scaleUp">
                        {/* Header */}
                        <div className="flex justify-between items-center w-full mb-4 border-b border-gray-100 pb-3">
                            <span className="text-xs font-black text-brand-dark flex items-center space-x-1">
                                <Gift size={14} className="text-brand-primary" />
                                <span>Voucher Quà Tặng</span>
                            </span>
                            <button 
                                onClick={() => setSelectedVoucher(null)}
                                className="text-gray-400 hover:text-brand-dark p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Coupon Details */}
                        <div className="w-full text-center space-y-1 mb-5">
                            <h3 className="text-base font-black text-brand-dark">{selectedVoucher.prizeName}</h3>
                            <p className="text-[10px] text-gray-400 font-bold">Trạng thái: <span className="text-brand-primary uppercase">Chưa sử dụng</span></p>
                        </div>

                        {/* Scannable Frame */}
                        <div className="relative w-full border border-gray-100 bg-gray-50/50 p-4 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden mb-5">
                            {/* Scanner laser line */}
                            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] z-10 animate-laser"></div>
                            
                            {/* Barcode representation using voucher code */}
                            <MemberBarcode value={selectedVoucher.voucherCode || `REWARD-${selectedVoucher.id.slice(0,8).toUpperCase()}`} />
                        </div>

                        <p className="text-[10px] text-gray-500 text-center font-bold px-2 leading-relaxed mb-6">
                            Đưa mã voucher trên cho nhân viên tại quầy POS để được quy đổi món uống hoặc phần quà tương ứng!
                        </p>

                        <div className="w-full space-y-2.5">
                            {/* Simulated POS Scan button for demonstrating end-to-end functionality */}
                            <button
                                onClick={() => handleSimulatePOS(selectedVoucher.id)}
                                disabled={posScanning}
                                className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-black rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center space-x-1.5"
                            >
                                <Award size={15} className={posScanning ? 'animate-spin' : ''} />
                                <span>{posScanning ? 'Đang xác minh quét...' : 'Giả lập POS Quét (Test nhanh) 🔍'}</span>
                            </button>

                            <button
                                onClick={() => setSelectedVoucher(null)}
                                className="w-full py-2.5 bg-gray-100 text-gray-500 font-bold rounded-xl active:scale-95 transition-all text-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    );
};