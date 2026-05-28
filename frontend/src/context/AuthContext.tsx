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
    authError: string | null;
    login: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getZaloUserInfo(): Promise<{ zaloId: string; name: string; avatar?: string; idByOA?: string; gender?: number; birthday?: string } | null> {
    try {
        await authorize({
            scopes: ['scope.userInfo']
        });

        const result = await getUserInfo({});
        console.log("Zalo SDK getUserInfo result:", result);

        if (result && result.userInfo) {
            const u = result.userInfo as any;
            return {
                zaloId: u.id,
                name: u.name,
                avatar: u.avatar,
                idByOA: u.idByOA,
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
    const [authError, setAuthError] = useState<string | null>(null);
    const loginInProgress = React.useRef(false);

    const isDev = import.meta.env.MODE === 'development';

    useEffect(() => {
        setIsLoading(false);
    }, []);

    async function login() {
        if (loginInProgress.current) return;
        loginInProgress.current = true;
        setIsLoading(true);
        setAuthError(null);
        try {
            let zaloInfo = await getZaloUserInfo();

            if (!zaloInfo) {
                if (isDev) {
                    console.warn("Zalo SDK Login failed (development mode). Kích hoạt tài khoản Mock để chạy thử...");
                    zaloInfo = {
                        zaloId: "mock-zalo-id-aizen-test",
                        name: "Khách Hàng Thử Nghiệm",
                        avatar: "https://placehold.co/150x150?text=Aizen+Test",
                        gender: 1,
                        birthday: "1998-08-08"
                    };
                } else {
                    throw new Error("Không thể lấy thông tin đăng nhập từ ứng dụng Zalo.");
                }
            }

            // Lấy accessToken từ Mini App (sẽ gửi lên backend để backend đặt httpOnly cookie)
            const accessToken = await getAccessToken({}).catch((err) => {
                if (isDev) {
                    return undefined;
                }
                throw new Error("Không thể lấy Access Token đăng nhập Zalo: " + (err.message || 'Lỗi không xác định'));
            });

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
                const resolvedUser = res && res.id ? res : null;
                setUser(resolvedUser);
                if (!resolvedUser || (res && res.success === false)) {
                    throw new Error(res?.message || 'Xác thực tài khoản với máy chủ thất bại.');
                }
            }
            } catch (error: any) {
            console.error('Login error:', error);
            if (isDev) {
                setUser({
                    id: "mock-cuid-for-offline-test",
                    zaloId: "mock-zalo-id-aizen-test",
                    name: "Khách Hàng Offline"
                } as any);
            } else {
                setAuthError(error.message || 'Đã xảy ra lỗi không xác định trong quá trình đăng nhập.');
                setUser(null);
            }
        } finally {
            setIsLoading(false);
            loginInProgress.current = false;
        }
    }

    function logout() {
        api.logout().finally(() => {
            setUser(null);
            setAuthError(null);
        });
    }

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isLoggedIn: !!user,
            authError,
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
