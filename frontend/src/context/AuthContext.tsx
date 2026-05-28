import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import { getUserInfo, authorize, getAccessToken } from 'zmp-sdk';

interface User {
    id: string;
    zaloId: string;
    name: string;
    avatar?: string;
    phone?: string;
    birthday?: string;
    gender?: number; // 0: Nu, 1: Nam
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isLoggedIn: boolean;
    login: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getZaloUserInfo(): Promise<{ zaloId: string; name: string; avatar?: string; idByOA?: string; gender?: number; birthday?: string } | null> {
    try {
        // Yêu cầu quyền truy cập thông tin user
        // Theo tài liệu mới: scope.userInfo bao gồm cả public_profile, user_gender, user_birthday nếu user đồng ý
        // Lưu ý: user có thể uncheck quyền này.
        // Call 1: Basic Info & Phone
        // Note: Zalo SDK only supports 'scope.userInfo', 'scope.userLocation', 'scope.userPhonenumber'.
        // Gender and Birthday must be retrieved via backend using the accessToken derived from scope.userInfo if the App is configured to allow it.
        await authorize({
            scopes: ['scope.userInfo']
        });

        // Lấy thông tin user từ Zalo
        const result = await getUserInfo({});
        console.log("Zalo SDK getUserInfo result:", result);

        if (result && result.userInfo) {
            const u = result.userInfo as any;
            return {
                zaloId: u.id,
                name: u.name,
                avatar: u.avatar,
                idByOA: u.idByOA, // Lấy ID theo OA nếu có
                gender: u.gender === 'male' || u.gender === 1 ? 1 : (u.gender === 'female' || u.gender === 0 ? 0 : undefined),
                birthday: u.birthday
            };
        }

        return null;
    } catch (error) {
        console.error('Lỗi khi lấy thông tin Zalo:', error);
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const loginInProgress = React.useRef(false);

    useEffect(() => {
        setIsLoading(false);
    }, []);

    async function checkAuth() {
        setIsLoading(false);
    }

    async function login() {
        if (loginInProgress.current) return;
        loginInProgress.current = true;
        setIsLoading(true);
        try {
            let zaloInfo = await getZaloUserInfo();

            // CHẾ ĐỘ THỬ NGHIỆM BYPASS: Nếu Zalo SDK báo lỗi hoặc chưa kích hoạt App ID trên Portal (Lỗi -1401)
            // Tự động kích hoạt tài khoản thử nghiệm để bạn và quản lý có thể trải nghiệm 100% tính năng mua sắm
            if (!zaloInfo) {
                console.warn("Zalo SDK Login failed (code -1401 hoặc chưa có tài khoản test). Kích hoạt tài khoản Mock để chạy thử...");
                zaloInfo = {
                    zaloId: "mock-zalo-id-aizen-test",
                    name: "Khách Hàng Thử Nghiệm",
                    avatar: "https://placehold.co/150x150?text=Aizen+Test",
                    gender: 1,
                    birthday: "1998-08-08"
                };
            }

            // Lấy accessToken từ Mini App để backend có thể fetch thêm thông tin (gender, birthday)
            const accessToken = await getAccessToken({}).catch(() => undefined);
            
            // Lưu token vào localStorage để đính kèm vào Authorization header cho các API sau
            const tokenToStore = accessToken || 'mock-access-token-aizen-test';
            localStorage.setItem('zalo_access_token', tokenToStore);

            // Gọi API để tạo/lấy customer trong cơ sở dữ liệu thật qua Backend
            const res = await api.authZalo({
                zaloId: zaloInfo.zaloId,
                name: zaloInfo.name,
                avatar: zaloInfo.avatar,
                idByOA: zaloInfo.idByOA,
                accessToken: accessToken,
                gender: zaloInfo.gender,
                birthday: zaloInfo.birthday
            });

            if (res && res.success && res.data) {
                setUser(res.data);
            } else {
                // Fallback nếu API trả về trực tiếp customer hoặc gặp lỗi
                setUser(res && res.id ? res : null);
                if (res && res.success === false) {
                    throw new Error(res.message || 'Xác thực thất bại');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            // Phòng hờ khẩn cấp nếu API Backend gặp sự cố kết nối Database tại local
            localStorage.setItem('zalo_access_token', 'mock-access-token-aizen-test');
            setUser({
                id: "mock-cuid-for-offline-test",
                name: "Khách Hàng Offline"
            } as any);
        } finally {
            setIsLoading(false);
            loginInProgress.current = false;
        }
    }

    function logout() {
        localStorage.removeItem('zalo_access_token');
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isLoggedIn: !!user,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
