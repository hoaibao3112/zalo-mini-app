// Tenant slug - chỉ đọc từ biến môi trường
export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || '388af042-5828-4777-8961-dc2cda5156a3';
export const API_HOST = import.meta.env.VITE_API_HOST || 'http://localhost:5000';
const API_BASE = `${API_HOST}/api/t/${TENANT_SLUG}`;

export interface Package {
    id: string;
    name: string;
    description: string | null;
    sellingPrice: number;
    originalPrice: number;
    imageUrl: string | null;
    quantity: number;
    unitId?: string;    // unit ID từ POS để tạo sale
    productId?: string; // product ID từ POS
}

export interface PackageOrder {
    id: string;
    packageName: string;
    amount: number;
    status: string;
    voucherCode: string | null;
    voucherSentAt: string | null;
    createdAt: string;
}


console.log('[API_CONFIG] Base URL:', API_BASE);

export const getMediaUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Handle both /uploads/... and uploads/...
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${API_HOST}${cleanUrl}`;
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
        ...options.headers
    };
    const res = await fetch(url, { ...options, headers, credentials: 'include' });
    const json = await res.json();
    return (json && json.success) ? json.data : json;
};

const fetchUnwrapped = async (url: string, options: RequestInit = {}) => {
    const headers = {
        'bypass-tunnel-reminder': 'true',
        ...options.headers
    };
    const res = await fetch(url, { ...options, headers, credentials: 'include' });
    const json = await res.json();
    return (json && json.success) ? json.data : json;
};

export const api = {
    getMediaUrl,
    // Categories
    getCategories: () => fetchUnwrapped(`${API_BASE}/categories`),

    // Products
    getProducts: (categoryId?: string) => {
        const url = categoryId
            ? `${API_BASE}/products?categoryId=${categoryId}`
            : `${API_BASE}/products`;
        return fetchUnwrapped(url);
    },
    getProduct: (id: string) => fetchUnwrapped(`${API_BASE}/products/${id}`),

    // Ecom Products (Nhanh/Haravan)
    getEcomProducts: (source: string = 'ALL', page?: number, limit?: number, keyword?: string) => {
        let url = `${API_BASE}/ecom/products?source=${source}`;
        if (page) url += `&page=${page}`;
        if (limit) url += `&limit=${limit}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        return fetchUnwrapped(url);
    },

    // Auth
    authZalo: (data: { zaloId: string; name: string; avatar?: string; phone?: string; idByOA?: string; accessToken?: string; gender?: number; birthday?: string }) =>
        fetch(`${API_BASE}/customers/auth/zalo`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': 'true'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        }).then(r => r.json()).then(res => (res && res.success) ? res.data : res),
    logout: () => fetch(`${API_BASE}/customers/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' }
    }).then(r => r.json()).then(res => (res && res.success) ? res.data : res).catch(() => null),

    // Customer
    updateCustomer: async (id: string, data: any) => {
        return fetchWithAuth(`${API_BASE}/customers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    updatePhone: (userId: string, token: string, accessToken: string) =>
        fetchWithAuth(`${API_BASE}/customers/phone/update`, {
            method: 'POST',
            body: JSON.stringify({ userId, token, accessToken })
        }),

    // Orders
    createOrder: (data: { customerId: string; items: any[]; total: number }) =>
        fetchWithAuth(`${API_BASE}/orders`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    createEcomOrder: (data: any) =>
        fetchWithAuth(`${API_BASE}/ecom/orders`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    getCustomerOrders: (customerId: string) =>
        fetchWithAuth(`${API_BASE}/orders/customer/${customerId}`),

    // Spin Game
    getActiveSpinGame: () => fetchUnwrapped(`${API_BASE}/spin-games/active?type=SPIN`),
    getSpinGameById: (id: string) => fetchUnwrapped(`${API_BASE}/spin-games/${id}`),
    getGamePlayerCredits: (gameId: string, customerId: string) =>
        fetchWithAuth(`${API_BASE}/spin-games/${gameId}/player-credits/${customerId}`),
    spin: (gameId: string, customerId: string) =>
        fetchWithAuth(`${API_BASE}/spin-games/${gameId}/spin`, {
            method: 'POST',
            body: JSON.stringify({ customerId })
        }),

    // Popup
    getActivePopup: () => fetchUnwrapped(`${API_BASE}/popups/active`),

    // Spin Credits
    getSpinCredits: (customerId: string) =>
        fetchWithAuth(`${API_BASE}/spin-credits/${customerId}`),
    addSpinCredits: (data: { customerId: string; type: string; reference?: string }) =>
        fetchWithAuth(`${API_BASE}/spin-credits/add`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    getSpinCreditRules: () => fetchUnwrapped(`${API_BASE}/spin-credits/rules/list`),
    getSpinCreditHistory: (customerId: string) =>
        fetchWithAuth(`${API_BASE}/spin-credits/${customerId}/history`),

    // Spin Rewards
    getSpinRewards: (customerId: string, status?: string) => {
        const url = status
            ? `${API_BASE}/spin-rewards/${customerId}?status=${status}`
            : `${API_BASE}/spin-rewards/${customerId}`;
        return fetchWithAuth(url);
    },
    useSpinReward: (rewardId: string) =>
        fetchWithAuth(`${API_BASE}/spin-rewards/${rewardId}/use`, {
            method: 'PUT'
        }),

    // Express Cafe POS Integration
    getExpressPackages: async (): Promise<{ packages: Package[] }> => {
        const res = await fetch(`${API_BASE}/express-packages`, {
            headers: {
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': 'true'
            },
            credentials: 'include'
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || json.message || 'Không thể tải danh sách package');
        }
        return json;
    },
    purchasePackage: async (idempotencyKey: string, data: {
        customerId: string;
        packageId: string;
        packageName: string;
        amount: number;
        customerName: string;
        phone: string;
        note?: string;
        unitId?: string;    // gửi lên để backend gọi POS
        productId?: string; // gửi lên để backend gọi POS
    }): Promise<{ orderId: string; status: string; message: string }> => {
        const res = await fetch(`${API_BASE}/express-packages/purchase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'idempotency-key': idempotencyKey,
                'bypass-tunnel-reminder': 'true'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || json.message || 'PURCHASE_FAILED');
        }
        return json;
    },
    getPackageOrders: async (customerId: string): Promise<{ orders: PackageOrder[] }> => {
        const res = await fetch(`${API_BASE}/express-packages/orders/${customerId}`, {
            headers: {
                'Content-Type': 'application/json',
                'bypass-tunnel-reminder': 'true'
            },
            credentials: 'include'
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || json.message || 'Không thể tải lịch sử đơn hàng');
        }
        return json;
    },
};
