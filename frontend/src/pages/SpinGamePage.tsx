import React, { useEffect, useState } from 'react';
import * as zmpSdk from 'zmp-sdk';
import { useNavigate } from 'react-router-dom';
import { api, getMediaUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Gift, Star, ChevronRight, X, Phone, User, ShoppingCart } from 'lucide-react';
import { EcomOrderConfirm } from '../components/EcomOrderConfirm';
import type { EcomProduct } from '../types/ecom';
interface SpinPrize {
    id: string;
    name: string;
    probability: number;
    value: string | null;
    color: string;
    imageUrl?: string;
    rewardType?: string;
    ecomProductId?: string | null;
    ecomVariantId?: string | null;
    slotIndex?: number;
}

interface SpinGame {
    id: string;
    name: string;
    gameType: string;
    wheelImage: string | null;
    buttonImage: string | null;
    backgroundImage: string | null;
    animationStyle: string | null;
    prizes: SpinPrize[];
    design?: {
        textColor?: string;
        spinsCountColor?: string;
        wheelSlots?: number;
        bannerImage?: string;
        pointerImage?: string;
        logoImage?: string;
        eggIntactImage?: string;
        eggBrokenImage?: string;
        hammerImage?: string;
        boxClosedImage?: string;
        boxOpenedImage?: string;
        congratsTitle?: string;
        closeButtonText?: string;
        popupTitleColor?: string;
        popupTextColor?: string;
        popupBgColor?: string;
    };
}

interface SpinCredit {
    balance: number;
    totalEarned: number;
    totalUsed: number;
}

interface SpinCreditRule {
    id: string;
    type: string;
    name: string;
    credits: number;
    description: string;
    icon: string;
}

interface SpinReward {
    id: string;
    prizeName: string;
    prizeValue: string | null;
    status: string;
    createdAt: string;
    game: { name: string };
}

export function SpinGamePage() {
    const navigate = useNavigate();
    const { user, isLoggedIn, login, isLoading: authLoading } = useAuth();
    const { addToCart } = useCart();
    const [game, setGame] = useState<SpinGame | null>(null);
    const [loading, setLoading] = useState(true);
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<SpinPrize | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [showEcomForm, setShowEcomForm] = useState(false);

    // Info Update Modal State
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [formData, setFormData] = useState({
        phone: '',
        gender: '' as 'male' | 'female' | '',
        birthday: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                phone: user.phone || '',
                gender: user.gender === 1 ? 'male' : user.gender === 0 ? 'female' : '',
                birthday: user.birthday || ''
            });
        }
    }, [user, showInfoModal]);

    // Spin Credits
    const [credits, setCredits] = useState<SpinCredit | null>(null);
    const [rules, setRules] = useState<SpinCreditRule[]>([]);
    const [rewards, setRewards] = useState<SpinReward[]>([]);
    const [activeTab, setActiveTab] = useState<'game' | 'rewards' | 'howto'>('game');
    const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

    useEffect(() => {
        loadGame();
        loadRules();
    }, []);

    // Flag to prevent multiple reward calls
    const [rewardClaimed, setRewardClaimed] = useState(false);

    useEffect(() => {
        if (user?.id && game?.id) {
            loadCredits();
            loadRewards();
        }
    }, [user?.id, game?.id]);

    // Apply first login reward only after credits are loaded and if balance is 0
    useEffect(() => {
        if (credits && credits.balance === 0 && !rewardClaimed) {
            setRewardClaimed(true);
            handleFirstLoginReward();
        }
    }, [credits, rewardClaimed]);

    async function loadGame() {
        try {
            const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
            const gameId = searchParams.get('id');
            
            let data;
            if (gameId) {
                data = await api.getSpinGameById(gameId);
            } else {
                data = await api.getActiveSpinGame();
            }
            if (data) {
                if (data.wheelImage) data.wheelImage = getMediaUrl(data.wheelImage);
                if (data.buttonImage) data.buttonImage = getMediaUrl(data.buttonImage);
                if (data.backgroundImage) data.backgroundImage = getMediaUrl(data.backgroundImage);
                if (data.design) {
                    const designImageKeys = ['pointerImage', 'logoImage', 'eggIntactImage', 'eggBrokenImage', 'hammerImage', 'boxClosedImage', 'boxOpenedImage', 'bannerImage', 'bgImage'];
                    designImageKeys.forEach(key => {
                        if (data.design[key]) data.design[key] = getMediaUrl(data.design[key]);
                    });
                }
                data.prizes = data.prizes ? data.prizes.map((p: any) => ({
                    ...p,
                    imageUrl: p.imageUrl ? getMediaUrl(p.imageUrl) : null
                })) : [];
                
                if (data.animationStyle) data.animationStyle = getMediaUrl(data.animationStyle);
                if (data.backgroundImage) data.backgroundImage = getMediaUrl(data.backgroundImage);
                if (data.wheelImage) data.wheelImage = getMediaUrl(data.wheelImage);
                if (data.buttonImage) data.buttonImage = getMediaUrl(data.buttonImage);
            }
            setGame(data);
        } catch (error) {
            console.error('Error loading game:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadCredits() {
        if (!user?.id || !game?.id) return;
        try {
            const data = await api.getGamePlayerCredits(game.id, user.id);
            setCredits(data);
        } catch (error) {
            console.error('Error loading credits:', error);
        }
    }

    async function loadRules() {
        try {
            const data = await api.getSpinCreditRules();
            setRules(data);
        } catch (error) {
            console.error('Error loading rules:', error);
        }
    }

    async function loadRewards() {
        if (!user?.id) return;
        try {
            const result = await api.getSpinRewards(user.id);
            // Handle both original array response and new cursor paginated response
            const items = Array.isArray(result) ? result : (result && Array.isArray(result.data) ? result.data : []);
            setRewards(items);
        } catch (error) {
            console.error('Error loading rewards:', error);
            setRewards([]);
        }
    }

    async function handleFirstLoginReward() {
        if (!user?.id) return;
        try {
            await api.addSpinCredits({
                customerId: user.id,
                type: 'FIRST_LOGIN'
            });
            // Reload credits after adding
            loadCredits();
        } catch {
            // Đã nhận rồi, bỏ qua
        }
    }

    async function handleDailyCheckin() {
        if (!user?.id) return;
        try {
            const result = await api.addSpinCredits({
                customerId: user.id,
                type: 'DAILY_CHECKIN'
            });
            if (result.success) {
                loadCredits();
                alert(`Điểm danh thành công! +${result.creditsAdded} lượt quay`);
            }
        } catch (error: any) {
            alert(error?.error || 'Đã điểm danh hôm nay rồi!');
        }
    }

    async function handleFollowOA() {
        if (!user?.id) return;
        try {
            // Thử dùng Zalo SDK followOA API thật
            const oaId = (import.meta as any).env.VITE_OA_ID;

            if (!oaId) {
                // Fallback for dev without OA ID
                console.warn("Missing VITE_OA_ID");
                const result = await api.addSpinCredits({
                    customerId: user.id,
                    type: 'FOLLOW_OA'
                });
                if (result.success) {
                    loadCredits();
                    alert(`Quan tâm OA thành công! +${result.creditsAdded} lượt quay`);
                }
                return;
            }

            if (zmpSdk && zmpSdk.authorize) {
                try {
                    // Authorize: Only request valid scopes
                    // Note: userGender and userBirthday are NOT valid scopes for authorize()
                    // They must be retrieved via OA form or manually input by user.
                    await zmpSdk.authorize({ scopes: ['scope.userInfo', 'scope.userPhonenumber'] });

                    // 2. Refresh Backend Session (fetch info from Zalo API)
                    await login();

                    // 3. Try Follow OA (Silent effort)
                    try {
                        if (zmpSdk.followOA && oaId) {
                            await zmpSdk.followOA({ id: oaId }).catch(() => { });
                        }
                    } catch (e) { }

                    // 4. Award Credits
                    const creditResult = await api.addSpinCredits({
                        customerId: user.id,
                        type: 'FOLLOW_OA'
                    });

                    if (creditResult.success) {
                        loadCredits();
                        alert(`Cập nhật thông tin thành công! +${creditResult.creditsAdded} lượt quay`);
                    } else {
                        alert('Cập nhật thành công!');
                    }
                    setShowInfoModal(false);

                } catch (authError: any) {
                    console.error("Authorize error:", authError);
                    alert("Vui lòng cấp quyền truy cập để tiếp tục nhận thưởng.");
                }
            } else {
                alert("Không thể kết nối với Zalo. Vui lòng thử lại trên điện thoại.");
            }
        } catch (error: any) {
            console.error("handleFollowOA error:", error);
            const errorMsg = error?.error || error?.message || 'Có lỗi xảy ra';
            alert(errorMsg);
        }
    }

    async function handleUpdateInfo(e: React.FormEvent) {
        e.preventDefault();
        if (!user?.id) return;

        try {
            const updateData: any = {};
            if (formData.phone) updateData.phone = formData.phone;
            if (formData.gender !== undefined && formData.gender !== '') {
                updateData.gender = formData.gender === 'male' ? 1 : 0;
            }
            if (formData.birthday) updateData.birthday = formData.birthday;

            const result = await api.updateCustomer(user.id, updateData);

            if (result && result.success !== false) {
                // Refresh user data
                await login();
                setShowInfoModal(false);
                alert("Cập nhật thông tin thành công!");
            } else {
                const errorMsg = result?.message || result?.error || "Có lỗi xảy ra khi cập nhật thông tin.";
                alert(errorMsg);
            }
        } catch (error: any) {
            console.error("Update Info Error:", error);
            alert("Có lỗi kết nối. Vui lòng thử lại.");
        }
    }

    async function handleGetPhoneNumber() {
        try {
            // Kiểm tra xem có đang ở chế độ mock user không
            if (user?.zaloId === 'mock-zalo-id-aizen-test') {
                const token = 'mock-phone-token-test';
                const accessToken = 'mock-access-token-aizen-test';
                const result = await api.updatePhone(user.id, token, accessToken);
                if (result && result.success !== false) {
                    await login();
                    setFormData(prev => ({ ...prev, phone: result.phone || prev.phone }));
                    alert("Cập nhật số điện thoại thành công!");
                } else {
                    const errorMsg = result?.message || result?.error || "Không thể cập nhật số điện thoại. Vui lòng thử lại.";
                    alert(errorMsg);
                }
                return;
            }

            if (zmpSdk.getPhoneNumber) {
                const { token } = await zmpSdk.getPhoneNumber({});
                const accessToken = await zmpSdk.getAccessToken();

                if (token && accessToken && user?.id) {
                    try {
                        const result = await api.updatePhone(user.id, token, accessToken);
                        if (result && result.success !== false) {
                            await login();
                            // Update local form state too
                            setFormData(prev => ({ ...prev, phone: result.phone || prev.phone }));
                            alert("Cập nhật số điện thoại thành công!");
                        } else {
                            const errorMsg = result?.message || result?.error || "Không thể cập nhật số điện thoại. Vui lòng thử lại.";
                            alert(errorMsg);
                        }
                    } catch (e) {
                        console.error(e);
                        alert("Lỗi kết nối.");
                    }
                } else {
                    alert("Không thể lấy thông tin xác thực.");
                }
            } else {
                alert("Môi trường không hỗ trợ Zalo SDK. Bạn vui lòng tự nhập tay số điện thoại.");
            }
        } catch (error) {
            console.error('Get Phone error:', error);
            alert("Không thể lấy số điện thoại tự động. Bạn vui lòng tự nhập số điện thoại thủ công vào ô trống nhé.");
        }
    }

    // Removed handleUpdateInfo as manual update is no longer supported

    const resolveAnimationRef = React.useRef<(() => void) | null>(null);

    const playSpinAnimation = async (prizeIndex: number) => {
        return new Promise<void>((resolve) => {
            let isResolved = false;
            
            const safeResolve = () => {
                if (isResolved) return;
                isResolved = true;
                resolve();
            };
            
            resolveAnimationRef.current = safeResolve;
            
            // Fallback timeout sau 4.5s phòng khi onTransitionEnd không fire (tab ẩn, v.v...)
            setTimeout(safeResolve, 4500);
            
            if (game?.gameType === 'SPIN') {
                 const currentPrize = game.prizes[prizeIndex];
                 const targetSlot = currentPrize?.slotIndex || (prizeIndex % totalSlots) + 1;
                 
                 const centerOfSlot = (targetSlot - 1) * sliceAngle + (sliceAngle / 2);
                 const targetAngle = 360 - centerOfSlot;
                 
                 const extraFullSpins = 360 * 5;
                 const newRotation = rotation + extraFullSpins + (targetAngle - (rotation % 360));
                 
                 setRotation(newRotation);
            } else {
                 if (game?.gameType !== 'GOLDEN_EGG' && game?.gameType !== 'MYSTERY_BOX') {
                     safeResolve();
                 }
            }
        });
    };

    const handleTransitionEnd = (e: React.TransitionEvent | React.AnimationEvent) => {
        // Chỉ xử lý transition của transform (Vòng quay) hoặc animation/transition chính.
        if (resolveAnimationRef.current) {
            resolveAnimationRef.current();
            resolveAnimationRef.current = null;
        }
    };

    async function handleSpin() {
        if (!isLoggedIn) {
            try {
                await login();
            } catch (error) {
                console.error('Login failed:', error);
                return;
            }
        }

        if (!game || !user || spinning) return;

        if (!user.phone || !user.birthday || user.gender === undefined || user.gender === null) {
            setShowInfoModal(true);
            return;
        }

        if (!credits || credits.balance <= 0) {
            setShowNoCreditsModal(true);
            return;
        }

        setSpinning(true);
        setShowResult(false);

        try {
            const response = await api.spin(game.id, user.id);
            if (response.error) {
                alert(response.error);
                return;
            }

            const { prize, prizeIndex, remainingSpins } = response;
            if (prize && prize.imageUrl) {
                prize.imageUrl = getMediaUrl(prize.imageUrl);
            }

            // Đợi animation xong
            if (game.gameType === 'SPIN') {
                await playSpinAnimation(prizeIndex);
            } else {
                // Với trứng/hộp quà thì hiện luôn phần thưởng
                await new Promise(r => setTimeout(r, 600)); // Thời gian cho đập trứng/mở hộp
            }
            
            setResult(prize);
            setShowResult(true);
            setCredits(prev => prev ? { ...prev, balance: remainingSpins } : null);
            loadRewards();
        } catch (error: any) {
            console.error('Spin error:', error);
            alert(error?.error || 'Có lỗi xảy ra');
        } finally {
            setSpinning(false);
        }
    }

    const handleClaimRewardToCart = () => {
        if (!result) return;
        
        if (result.rewardType === 'NHANH_PRODUCT' || result.rewardType === 'HARAVAN_PRODUCT') {
            const platformName = result.rewardType === 'NHANH_PRODUCT' ? 'NHANH' : 'HARAVAN';
            
            const cartItem = {
                id: String(result.ecomProductId || `reward_${Date.now()}`),
                externalId: result.ecomProductId ? Number(result.ecomProductId) : undefined,
                name: `🎁 [QUÀ TẶNG] ${result.name}`,
                description: `Quà tặng E-commerce từ Vòng Quay May Mắn`,
                price: 0, 
                salePrice: 0,
                image: result.imageUrl || 'https://placehold.co/150x150?text=Qua+Tang',
                categoryId: 'ecom_rewards',
                cartId: `reward-${result.id}-${Date.now()}`,
                quantity: 1,
                size: 'M' as const,
                milkLevel: 50,
                platform: platformName as 'NHANH' | 'HARAVAN'
            };
            
            addToCart(cartItem as any);
            setShowResult(false);
            
            alert(`🎉 Đã thêm quà tặng "${result.name}" vào Giỏ Hàng của bạn với giá 0đ!`);
            navigate('/cart');
        } else {
            if (result.value) {
                try {
                    navigator.clipboard.writeText(result.value);
                    alert(`🎉 Đã tự động sao chép mã ưu đãi: ${result.value}\nBạn hãy dán mã giảm giá này khi điền thông tin đơn hàng nhé!`);
                } catch (e) {
                    console.error('Failed to copy', e);
                }
            }
            setShowResult(false);
            navigate('/cart');
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-500 to-red-600">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-500 to-red-600 text-white p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Chưa có game nào</h2>
                    <p className="opacity-80 mb-4">Vòng quay chưa được kích hoạt</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-white text-orange-600 rounded-full font-semibold"
                    >
                        Quay lại
                    </button>
                </div>
            </div>
        );
    }

    const totalSlots = game.design?.wheelSlots && game.design.wheelSlots > 0 
        ? game.design.wheelSlots 
        : (game.prizes.length || 1);
    const sliceAngle = 360 / totalSlots;

    return (
        <div
            className="min-h-screen flex flex-col bg-cover bg-center"
            style={{
                paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
                backgroundImage: game.backgroundImage 
                    ? `url(${getMediaUrl(game.backgroundImage)})` 
                    : 'linear-gradient(to bottom, #f97316, #dc2626)'
            }}
        >
            {/* Safe Area Spacer for Status Bar + Nav height */}
            <div style={{ height: 'calc(env(safe-area-inset-top, 24px) + 44px)' }} className="w-full shrink-0" />

            {/* Header - Compact */}
            <div className="text-center text-white py-4 lg:py-6 px-4 shrink-0 z-10 relative">
                {game.animationStyle && (
                    <div className="mb-2 lg:mb-4 flex justify-center">
                        <img src={getMediaUrl(game.animationStyle)} className="max-h-24 lg:max-h-32 object-contain" alt="Banner" />
                    </div>
                )}
                <h1 
                    className="text-xl lg:text-3xl font-black uppercase tracking-wider drop-shadow-md"
                    style={{ color: game.design?.textColor || '#ffffff' }}
                >
                    {game.name}
                </h1>
                {isLoggedIn && user && (
                    <p 
                        className="text-xs lg:text-sm opacity-90 font-medium mt-1"
                        style={{ color: game.design?.textColor || '#ffffff' }}
                    >
                        Xin chào, {user.name}!
                    </p>
                )}
            </div>

            {/* Main Content Area - Responsive: 1 col mobile, 2 col desktop */}
            <div className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 gap-4">

                {/* Tabs bar */}
                <div className="flex justify-center space-x-2 mb-4 px-4 shrink-0 z-10">
                    <button
                        onClick={() => setActiveTab('game')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all shadow-sm ${activeTab === 'game'
                            ? 'bg-white text-orange-600 shadow-md transform scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        {game.gameType === 'MYSTERY_BOX' ? 'Mở Hộp' : game.gameType === 'GOLDEN_EGG' ? 'Đập Trứng' : 'Vòng quay'}
                    </button>
                    <button
                        onClick={() => setActiveTab('rewards')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all shadow-sm ${activeTab === 'rewards'
                            ? 'bg-white text-orange-600 shadow-md transform scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        Phần thưởng
                    </button>
                    <button
                        onClick={() => setActiveTab('howto')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all shadow-sm ${activeTab === 'howto'
                            ? 'bg-white text-orange-600 shadow-md transform scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        Kiếm lượt
                    </button>
                </div>

                {/* LEFT COLUMN: Wheel - always visible on desktop, tab-controlled on mobile */}
                <div className={`${activeTab !== 'game' ? 'hidden' : 'flex-1 flex flex-col items-center justify-center'} p-4 relative animate-in fade-in duration-300 w-full`}>
                    {/* Credits Badge */}
                    {isLoggedIn && credits && (
                        <div className="mb-4 lg:mb-6 flex justify-center">
                            <div className="bg-black/20 backdrop-blur-sm border border-white/20 rounded-full px-5 py-1.5 flex items-center gap-2 shadow-lg">
                                <Star className="w-4 h-4 text-yellow-300 animate-pulse" fill="currentColor" />
                                <span 
                                    className="text-white font-bold text-base"
                                    style={{ color: game.design?.spinsCountColor || game.design?.textColor || '#ffffff' }}
                                >
                                    {credits.balance} lượt
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Game Container - responsive sizing */}
                    {game.gameType === 'MYSTERY_BOX' ? (
                        <>
                            <div className="grid grid-cols-3 gap-3 p-2 w-[min(90vw,300px)] aspect-square relative z-10 animate-in slide-in-from-bottom-4 duration-500">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={handleSpin}
                                        disabled={spinning}
                                        className={`aspect-square backdrop-blur-md rounded-xl border flex items-center justify-center transition-all duration-500 cursor-pointer
                                            ${!spinning ? 'bg-white/30 border-white/60 animate-gift-pulse hover:bg-white/40' : 'bg-white/20 border-white/30 opacity-80 scale-95'}
                                            ${showResult ? 'bg-white border-yellow-400 border-4 shadow-2xl animate-bounce' : ''}
                                        `}
                                        style={{ animationDelay: `${i * 0.15}s` }}
                                    >
                                        <div className="relative flex items-center justify-center w-full h-full">
                                            {game.design?.boxClosedImage ? (
                                                <img 
                                                    src={getMediaUrl(showResult ? (game.design.boxOpenedImage || game.design.boxClosedImage) : game.design.boxClosedImage)} 
                                                    className={`transition-all duration-300 ${!spinning ? 'w-20 h-20' : 'w-16 h-16'}`}
                                                    alt="Box"
                                                />
                                            ) : (
                                                <Gift className={`text-yellow-300 transition-all duration-300 ${!spinning ? 'w-10 h-10 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)]' : 'w-8 h-8 drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]'}`} />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={handleSpin}
                                disabled={spinning}
                                className={`mt-4 px-10 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-xl transition-all ${spinning
                                    ? 'bg-white/30 text-white/60 cursor-not-allowed'
                                    : 'bg-white text-orange-600 hover:scale-105 active:scale-95'}`}
                            >
                                {spinning ? 'Đang mở...' : 'Mở Hộp Quà!'}
                            </button>
                        </>
                    ) : game.gameType === 'GOLDEN_EGG' ? (
                        <>
                            <div className="flex flex-col items-center justify-center w-full max-w-[320px] relative z-10 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="relative group cursor-pointer flex flex-col items-center justify-end w-full h-72" onClick={!spinning ? handleSpin : undefined}>
                                    {/* Shadow */}
                                    <div className={`absolute bottom-[-10px] w-48 h-8 bg-black/30 blur-md rounded-[50%] transition-all duration-500 ${spinning && showResult ? 'opacity-0 scale-50' : 'group-hover:scale-95 group-hover:opacity-60'}`}></div>

                                    {/* Egg Container */}
                                    <div className="absolute bottom-4 w-56 h-72 z-10 flex items-end justify-center">

                                        {/* Solid Egg (Visible only when idle) */}
                                        {game.design?.eggIntactImage ? (
                                            <img
                                                src={getMediaUrl(game.design.eggIntactImage)}
                                                className={`absolute bottom-0 w-56 h-auto transition-transform duration-300 ${!spinning ? 'group-hover:-translate-y-2 group-hover:scale-105' : ''}
                                                    ${spinning ? 'opacity-0' : 'opacity-100'}`}
                                                alt="Egg"
                                            />
                                        ) : (
                                            <div
                                                className={`absolute bottom-0 w-56 h-72 bg-gradient-to-tr from-[#f59e0b] via-[#fbbf24] to-[#fef3c7] shadow-[inset_-15px_-15px_40px_rgba(217,119,6,0.6),inset_15px_15px_40px_rgba(255,255,255,0.9)] transition-transform duration-300 ${!spinning ? 'group-hover:-translate-y-2 group-hover:scale-105' : ''}
                                                        ${spinning ? 'opacity-0' : 'opacity-100'}
                                                    `}
                                                style={{ borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%' }}
                                            >
                                                <div className="absolute top-8 left-10 w-20 h-32 bg-white/50 blur-2xl rounded-full -rotate-12"></div>
                                            </div>
                                        )}

                                        {/* Top Half (Broken) */}
                                        {game.design?.eggBrokenImage ? (
                                            <img
                                                src={getMediaUrl(game.design.eggBrokenImage)}
                                                className={`absolute bottom-0 w-56 h-auto transition-all duration-700 ease-out origin-bottom
                                                    ${!spinning ? 'opacity-0' : 'opacity-100'}
                                                    ${spinning && !showResult ? 'animate-[shake_0.5s_infinite] brightness-110' : ''}
                                                    ${spinning && showResult ? '-translate-y-32 -translate-x-16 -rotate-[30deg] opacity-0 scale-110' : ''}`}
                                                alt="Broken Egg Top"
                                                style={{ clipPath: 'inset(0% 0% 50% 0%)' }}
                                            />
                                        ) : (
                                            <div
                                                className={`absolute bottom-0 w-56 h-72 bg-gradient-to-tr from-[#f59e0b] via-[#fbbf24] to-[#fef3c7] shadow-[inset_-15px_-15px_40px_rgba(217,119,6,0.6),inset_15px_15px_40px_rgba(255,255,255,0.9)] transition-all duration-700 ease-out origin-bottom
                                                        ${!spinning ? 'opacity-0' : 'opacity-100'}
                                                        ${spinning && !showResult ? 'animate-[shake_0.5s_infinite] brightness-110' : ''}
                                                        ${spinning && showResult ? '-translate-y-32 -translate-x-16 -rotate-[30deg] opacity-0 scale-110' : ''}
                                                    `}
                                                style={{
                                                    clipPath: 'polygon(0% 0%, 100% 0%, 100% 45%, 80% 55%, 60% 40%, 40% 60%, 20% 40%, 0% 50%)',
                                                    borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%'
                                                }}
                                            >
                                                <div className="absolute top-8 left-10 w-20 h-32 bg-white/50 blur-2xl rounded-full -rotate-12"></div>
                                            </div>
                                        )}

                                        {/* Bottom Half (Broken) */}
                                        {game.design?.eggBrokenImage ? (
                                            <img
                                                src={getMediaUrl(game.design.eggBrokenImage)}
                                                className={`absolute bottom-0 w-56 h-auto transition-all duration-700 ease-out origin-top
                                                    ${!spinning ? 'opacity-0' : 'opacity-100'}
                                                    ${spinning && !showResult ? 'animate-[shake_0.5s_infinite] brightness-110' : ''}
                                                    ${spinning && showResult ? 'translate-y-24 translate-x-16 rotate-[30deg] opacity-0 scale-110' : ''}`}
                                                alt="Broken Egg Bottom"
                                                style={{ clipPath: 'inset(50% 0% 0% 0%)' }}
                                            />
                                        ) : (
                                            <div
                                                className={`absolute bottom-0 w-56 h-72 bg-gradient-to-tr from-[#f59e0b] via-[#fbbf24] to-[#fef3c7] shadow-[inset_-15px_-15px_40px_rgba(217,119,6,0.6),inset_15px_15px_40px_rgba(255,255,255,0.9)] transition-all duration-700 ease-out origin-top
                                                        ${!spinning ? 'opacity-0' : 'opacity-100'}
                                                        ${spinning && !showResult ? 'animate-[shake_0.5s_infinite] brightness-110' : ''}
                                                        ${spinning && showResult ? 'translate-y-24 translate-x-16 rotate-[30deg] opacity-0 scale-110' : ''}
                                                    `}
                                                style={{
                                                    clipPath: 'polygon(0% 50%, 20% 40%, 40% 60%, 60% 40%, 80% 55%, 100% 45%, 100% 100%, 0% 100%)',
                                                    borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%'
                                                }}
                                            ></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={!spinning ? handleSpin : undefined}
                                disabled={spinning}
                                className={`mt-2 px-10 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-xl transition-all ${spinning
                                    ? 'bg-white/30 text-white/60 cursor-not-allowed'
                                    : 'bg-white text-orange-600 hover:scale-105 active:scale-95'}`}
                            >
                                {spinning ? 'Đang đập...' : 'Đập Trứng!'}
                            </button>
                        </>
                    ) : (
                        <div className="relative" style={{ width: 'min(80vw, 320px)', height: 'min(80vw, 320px)' }}>
                            {/* Pointer */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 filter drop-shadow-lg">
                                {game.design?.pointerImage ? (
                                    <div className="w-12 h-12 flex items-center justify-center">
                                        <img src={getMediaUrl(game.design.pointerImage)} className="w-full h-full object-contain" alt="Pointer" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-10 bg-red-600 border-2 border-white rounded-t-lg relative">
                                        <div className="absolute top-full left-0 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[16px] border-l-transparent border-r-transparent border-t-red-600 -mt-[2px]"></div>
                                    </div>
                                )}
                            </div>

                            {/* Outer Rim/Shadow */}
                            <div className="absolute -inset-4 rounded-full bg-gradient-to-b from-orange-500 to-red-600 shadow-2xl scale-[1.02] border-4 border-yellow-400"></div>
                            <div className="absolute -inset-2 rounded-full border-[6px] border-dashed border-yellow-200/50 opacity-80 animate-[spin_20s_linear_infinite]"></div>

                            {/* Wheel SVG */}
                            <div
                                onTransitionEnd={handleTransitionEnd}
                                className="absolute inset-0 rounded-full border-4 border-white shadow-inner overflow-hidden bg-white z-10 transition-transform duration-[4s] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                                style={{ transform: `rotate(${rotation}deg)` }}
                            >
                                {game.wheelImage && (
                                    <img src={getMediaUrl(game.wheelImage)} className="absolute inset-0 w-full h-full object-cover z-0" alt="Wheel" />
                                )}
                                
                                <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full z-10">
                                    {totalSlots === 0 ? (
                                        <circle cx="150" cy="150" r="148" fill={game.wheelImage ? 'transparent' : '#f3f4f6'} />
                                    ) : (
                                        Array.from({ length: totalSlots }).map((_, i) => {
                                            const slotIdx = i + 1;
                                            const prize = game.prizes.find(p => (p.slotIndex || (game.prizes.indexOf(p) % totalSlots) + 1) === slotIdx);
                                            
                                            const startAngle = i * sliceAngle;
                                            const endAngle = (i + 1) * sliceAngle;
                                            const textAngle = startAngle + sliceAngle / 2;

                                            const radius = 150;
                                            const center = 150;

                                            const startRad = (endAngle - 90) * Math.PI / 180.0;
                                            const endRad = (startAngle - 90) * Math.PI / 180.0;

                                            const startX = center + (radius * Math.cos(startRad));
                                            const startY = center + (radius * Math.sin(startRad));
                                            const endX = center + (radius * Math.cos(endRad));
                                            const endY = center + (radius * Math.sin(endRad));
                                            const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

                                            const d = [
                                                "M", center, center,
                                                "L", startX, startY,
                                                "A", radius, radius, 0, largeArcFlag, 0, endX, endY,
                                                "L", center, center
                                            ].join(" ");

                                            const textRad = (textAngle - 90) * Math.PI / 180.0;
                                            const textRadius = radius * 0.65;
                                            const textPosX = center + (textRadius * Math.cos(textRad));
                                            const textPosY = center + (textRadius * Math.sin(textRad));

                                            const prizeName = prize ? prize.name : 'Chúc may mắn';
                                            const prizeColor = prize ? (prize.color || (i % 2 === 0 ? '#2563eb' : '#1d4ed8')) : (i % 2 === 0 ? '#2563eb' : '#1d4ed8');

                                            return (
                                                <g key={i}>
                                                    <path
                                                        d={d}
                                                        fill={game.wheelImage ? 'transparent' : prizeColor}
                                                        stroke={game.wheelImage ? 'transparent' : 'white'}
                                                        strokeWidth={game.wheelImage ? '0' : '2'}
                                                    />
                                                    <g transform={`translate(${textPosX}, ${textPosY}) rotate(${textAngle + 90})`}>
                                                        {prize?.imageUrl ? (
                                                            <image
                                                                href={prize.imageUrl}
                                                                x="-15"
                                                                y="-15"
                                                                height="30"
                                                                width="30"
                                                                preserveAspectRatio="xMidYMid slice"
                                                                style={{ borderRadius: '50%' }}
                                                            />
                                                        ) : (
                                                            <text
                                                                x="0"
                                                                y="0"
                                                                fill="white"
                                                                textAnchor="middle"
                                                                dominantBaseline="middle"
                                                                fontSize="10"
                                                                fontWeight="bold"
                                                                style={{
                                                                    textShadow: '0px 1px 2px rgba(0,0,0,0.5)',
                                                                    fontFamily: 'Outfit, sans-serif'
                                                                }}
                                                            >
                                                                {prizeName.length > 10 ? prizeName.substring(0, 8) + '..' : prizeName}
                                                            </text>
                                                        )}
                                                    </g>
                                                </g>
                                            );
                                        })
                                    )}

                                    {/* Center Logo/Icon */}
                                    {game.design?.logoImage && (
                                        <image
                                            href={game.design.logoImage}
                                            x="115"
                                            y="115"
                                            height="70"
                                            width="70"
                                            preserveAspectRatio="xMidYMid meet"
                                        />
                                    )}
                                </svg>
                            </div>

                            {/* Center Button */}
                            <button
                                onClick={handleSpin}
                                disabled={spinning}
                                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400 rounded-full shadow-[0_4px_0_#d97706] flex items-center justify-center border-4 border-white overflow-hidden transition-all z-20 ${game.buttonImage ? 'w-20 h-20 p-0 border-none bg-transparent shadow-none hover:scale-105 active:scale-95' : 'w-16 h-16 lg:w-20 lg:h-20 font-black text-orange-700 text-sm lg:text-base tracking-wide uppercase'} ${spinning ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105 active:scale-95 active:shadow-none active:translate-y-1'}`}
                            >
                                {game.buttonImage ? (
                                    <img src={getMediaUrl(game.buttonImage)} className="w-full h-full object-contain" alt="Spin" />
                                ) : (
                                    spinning ? '...' : 'QUAY'
                                )}
                            </button>
                        </div>
                    )}

                    {/* Login hint */}
                    {!isLoggedIn && (
                        <p className="text-white/90 text-sm mt-8 text-center bg-black/20 px-4 py-2 rounded-lg font-medium">
                            Nhấn <span className="font-bold text-yellow-300">QUAY</span> để đăng nhập và tham gia
                        </p>
                    )}
                </div>

                {/* RIGHT COLUMN: Tabs + Content - always visible on desktop */}
                <div className={`${activeTab === 'game' ? 'hidden' : 'flex-1 flex flex-col overflow-hidden'} w-full`}>

                    {/* Tab: Rewards (Scrollable) */}
                    {activeTab === 'rewards' && (
                        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-white/5 rounded-t-3xl lg:rounded-2xl mt-4 lg:mt-0 border-t lg:border border-white/10">
                            {!isLoggedIn ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/50">
                                    <Gift className="w-16 h-16 mb-4 opacity-50" strokeWidth={1.5} />
                                    <p>Đăng nhập để xem phần thưởng</p>
                                </div>
                            ) : rewards.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/80">
                                    <div className="bg-white/10 p-6 rounded-full mb-4">
                                        <Gift className="w-12 h-12 opacity-80" />
                                    </div>
                                    <p className="font-medium text-lg">Chưa có phần thưởng nào</p>
                                    <p className="text-sm opacity-70 mt-1">Quay ngay để nhận thưởng!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 pb-20 lg:pb-4">
                                    {rewards.map(reward => (
                                        <div key={reward.id} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm">
                                            <div>
                                                <p className="font-bold text-gray-800 line-clamp-1">{reward.prizeName}</p>
                                                {reward.prizeValue && (
                                                    <p className="text-xs text-gray-500 font-medium mt-0.5">Giá trị: <span className="text-orange-600">{reward.prizeValue}</span></p>
                                                )}
                                                <p className="text-[10px] text-gray-400 mt-1 flex items-center">
                                                    {new Date(reward.createdAt).toLocaleDateString('vi-VN')}
                                                </p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${reward.status === 'PENDING'
                                                ? 'bg-green-50 text-green-600 border border-green-100'
                                                : reward.status === 'USED'
                                                    ? 'bg-gray-100 text-gray-500'
                                                    : 'bg-red-50 text-red-600'
                                                }`}>
                                                {reward.status === 'PENDING' ? 'Có thể dùng' : reward.status === 'USED' ? 'Đã dùng' : 'Hết hạn'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: How To (Scrollable) */}
                    {activeTab === 'howto' && (
                        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-white/5 rounded-t-3xl lg:rounded-2xl mt-4 lg:mt-0 border-t lg:border border-white/10">
                            <div className="space-y-3 pb-20 lg:pb-4">
                                {/* Actions */}
                                {isLoggedIn && (
                                    <>
                                        <button
                                            onClick={handleDailyCheckin}
                                            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl p-4 flex items-center justify-between font-bold shadow-md active:scale-[0.98] transition-transform"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">📅</span>
                                                <span className="text-sm">Điểm danh hàng ngày</span>
                                            </div>
                                            <ChevronRight className="w-5 h-5 opacity-80" />
                                        </button>

                                        <button
                                            onClick={handleFollowOA}
                                            className="w-full bg-blue-600 text-white rounded-xl p-4 flex items-center justify-between font-bold shadow-md active:scale-[0.98] transition-transform"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">💙</span>
                                                <span className="text-sm">Quan tâm Zalo OA</span>
                                            </div>
                                            <ChevronRight className="w-5 h-5 opacity-80" />
                                        </button>
                                    </>
                                )}

                                {/* Rules List */}
                                <h3 className="text-white/80 font-bold text-sm uppercase tracking-wider mt-6 mb-2 pl-1">Cách tính lượt quay</h3>
                                {rules.map(rule => (
                                    <div key={rule.id} className="bg-white/90 backdrop-blur rounded-xl p-4 flex items-center gap-4 shadow-sm border border-white/50">
                                        <div className="text-2xl w-8 text-center">{rule.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{rule.name}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2">{rule.description}</p>
                                        </div>
                                        <div className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap border border-orange-200">
                                            +{rule.credits} lượt
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Default: show rewards on desktop when game tab (mobile) - Removed for 1-column layout */}
                </div>
            </div>

            {/* Bottom Nav / Back (Fixed) */}
            <div className="p-4 flex justify-center shrink-0 safe-pb">
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2.5 bg-black/20 hover:bg-black/30 text-white/90 rounded-full text-sm font-semibold backdrop-blur-sm transition-colors border border-white/10 flex items-center gap-2"
                >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Quay lại Trang chủ
                </button>
            </div>

            {/* Modals remain unchanged... */}
            {/* Premium Win Result Modal */}
            {
                showResult && result && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowResult(false)}
                        />

                        {/* Modal Card */}
                        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 transform transition-all border border-white/20">
                            {/* Sunburst Background Effect */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
                                <div
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] animate-[spin_10s_linear_infinite]"
                                    style={{
                                        background: 'conic-gradient(from 0deg, transparent 0deg 15deg, #fbbf24 15deg 30deg, transparent 30deg 45deg, #fbbf24 45deg 60deg, transparent 60deg 75deg, #fbbf24 75deg 90deg, transparent 90deg 105deg, #fbbf24 105deg 120deg, transparent 120deg 135deg, #fbbf24 135deg 150deg, transparent 150deg 165deg, #fbbf24 165deg 180deg, transparent 180deg 195deg, #fbbf24 195deg 210deg, transparent 210deg 225deg, #fbbf24 225deg 240deg, transparent 240deg 255deg, #fbbf24 255deg 270deg, transparent 270deg 285deg, #fbbf24 285deg 300deg, transparent 300deg 315deg, #fbbf24 315deg 330deg, transparent 330deg 345deg, #fbbf24 345deg 360deg)'
                                    }}
                                />
                            </div>

                            {/* Confetti / Sparkles */}
                            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                                <div className="absolute top-1/4 left-1/4 text-2xl animate-bounce delay-100">✨</div>
                                <div className="absolute top-1/3 right-1/4 text-xl animate-pulse delay-700">🌟</div>
                                <div className="absolute bottom-1/3 left-1/3 text-3xl animate-ping duration-1000 opacity-20">🎉</div>
                            </div>

                            {/* Content */}
                            <div className="relative p-8 flex flex-col items-center text-center z-10">
                                {/* Icon Header */}
                                <div className="mb-6 relative group">
                                    <div className="absolute inset-0 bg-yellow-400 rounded-full blur-2xl opacity-40 animate-pulse group-hover:opacity-60 transition-opacity" />
                                    <div className="relative bg-white p-4 rounded-full shadow-lg border-4 border-yellow-100 flex items-center justify-center" style={{ width: '80px', height: '80px' }}>
                                        {result.imageUrl ? (
                                            <img src={result.imageUrl} alt={result.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
                                        ) : (
                                            <Gift className="w-12 h-12 text-orange-500" strokeWidth={2} />
                                        )}
                                    </div>
                                    <div className="absolute -top-2 -right-2 text-3xl animate-bounce">🎁</div>
                                </div>

                                <h2 
                                    className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 mb-1 uppercase tracking-wide drop-shadow-sm font-outfit"
                                    style={game.design?.popupTitleColor ? { backgroundImage: 'none', color: game.design.popupTitleColor, WebkitTextFillColor: game.design.popupTitleColor } : {}}
                                >
                                    {game.design?.congratsTitle || 'Xin Chúc Mừng!'}
                                </h2>
                                <p className="text-gray-500 font-medium mb-6 text-sm" style={{ color: game.design?.popupTextColor || undefined }}>Bạn đã may mắn nhận được</p>

                                {/* Prize Card */}
                                <div 
                                    className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-100 rounded-2xl p-6 mb-6 shadow-[0_4px_20px_-10px_rgba(251,146,60,0.3)] relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                                    style={{ backgroundColor: game.design?.popupBgColor || undefined, backgroundImage: game.design?.popupBgColor ? 'none' : undefined }}
                                >
                                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-gradient-to-br from-yellow-300 to-orange-300 rounded-full opacity-20" />
                                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-gradient-to-tr from-yellow-300 to-orange-300 rounded-full opacity-20" />

                                    <h3
                                        className="text-2xl font-black text-gray-800 mb-2 drop-shadow-sm relative z-10 leading-tight"
                                        style={{ color: result.color || game.design?.popupTextColor || '#d97706' }}
                                    >
                                        {result.name}
                                    </h3>

                                    {result.value && (
                                        <div className="inline-flex items-center gap-1.5 bg-white/60 backdrop-blur px-3 py-1 rounded-full border border-white/50 shadow-sm relative z-10 mt-1">
                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                            <span className="text-xs font-bold text-gray-600">
                                                Giá trị: <span className="text-orange-600">{result.value}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer / Action */}
                                <div className="w-full space-y-3">
                                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        <span>Lượt quay còn lại: <span className="text-orange-600 text-sm">{credits?.balance || 0}</span></span>
                                    </div>

                                    <button
                                        onClick={handleClaimRewardToCart}
                                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold text-lg shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
                                        style={game.design?.textColor ? { backgroundColor: game.design.textColor, backgroundImage: 'none' } : {}}
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <ShoppingCart className="w-5 h-5 relative z-10" />
                                        <span className="relative z-10">
                                            {result.rewardType === 'NHANH_PRODUCT' || result.rewardType === 'HARAVAN_PRODUCT' 
                                                ? 'Nạp Vào Giỏ Hàng 🛒' 
                                                : (game.design?.closeButtonText || 'Nhận Thưởng Ngay')}
                                        </span>
                                        <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Info Update Modal */}
            {
                showInfoModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-sm relative shadow-xl overflow-hidden">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                                    <User className="w-8 h-8 text-blue-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Cập nhật thông tin</h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    Vui lòng hoàn tất thông tin để nhận thưởng
                                </p>
                            </div>

                            <form onSubmit={handleUpdateInfo} className="space-y-4">
                                {!user?.phone && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Số điện thoại</label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                required
                                                placeholder="0912345678"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pl-11 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-gray-800"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                            <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGetPhoneNumber}
                                            className="text-[10px] text-blue-600 font-bold mt-1.5 ml-1 flex items-center gap-1 hover:underline"
                                        >
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/1200px-Icon_of_Zalo.svg.png" className="w-3 h-3" alt="Zalo" />
                                            Lấy số điện thoại từ Zalo
                                        </button>
                                    </div>
                                )}

                                {(user?.gender === undefined || user?.gender === null) && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Giới tính</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                className={`py-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all ${formData.gender === 'male'
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => setFormData({ ...formData, gender: 'male' })}
                                            >
                                                <span className="text-lg">👨</span> Nam
                                            </button>
                                            <button
                                                type="button"
                                                className={`py-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all ${formData.gender === 'female'
                                                    ? 'bg-pink-50 border-pink-200 text-pink-700 shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => setFormData({ ...formData, gender: 'female' })}
                                            >
                                                <span className="text-lg">👩</span> Nữ
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!user?.birthday && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Ngày sinh</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-gray-800"
                                            value={formData.birthday}
                                            onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                                >
                                    Xác nhận thông tin
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* No Credits Modal */}
            {
                showNoCreditsModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                        <div className="bg-white rounded-3xl p-6 mx-6 text-center max-w-sm w-full relative">
                            <button
                                onClick={() => setShowNoCreditsModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="text-6xl mb-4">😔</div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">Hết lượt quay rồi!</h2>
                            <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                                Rất tiếc, bạn đã dùng hết lượt quay. Hãy thực hiện nhiệm vụ để nhận thêm lượt nhé!
                            </p>
                            <button
                                onClick={() => {
                                    setShowNoCreditsModal(false);
                                    setActiveTab('howto');
                                }}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all"
                            >
                                Xem cách kiếm thêm lượt
                            </button>
                        </div>
                    </div>
                )
            }
            {/* Ecom Form Modal */}
            {showEcomForm && result && (result.rewardType === 'NHANH_PRODUCT' || result.rewardType === 'HARAVAN_PRODUCT') && (
                <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto sm:rounded-2xl relative">
                        <EcomOrderConfirm
                            product={{
                                id: result.ecomProductId || '',
                                name: result.name,
                                image: result.imageUrl || '',
                                price: parseInt(result.value || '0', 10) || 0,
                                platform: result.rewardType === 'NHANH_PRODUCT' ? 'NHANH' : 'HARAVAN',
                                externalId: parseInt(result.ecomProductId || '0', 10)
                            }}
                            selectedVariantId={result.ecomVariantId ? parseInt(result.ecomVariantId, 10) : undefined}
                            quantity={1}
                            onClose={() => setShowEcomForm(false)}
                            onSuccess={(orderId) => {
                                alert('Tạo đơn hàng thành công! Mã đơn: ' + orderId);
                                setShowEcomForm(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div >
    );
}
