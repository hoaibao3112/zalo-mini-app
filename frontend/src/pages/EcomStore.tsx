import React, { useState } from 'react';
import { Page, Header, Box, Text, Button, Input } from 'zmp-ui';
import { Search, RefreshCw, Store, AlertCircle } from 'lucide-react';
import { BottomNav } from '../components/layout/BottomNav';
import { EcomProductCard } from '../components/EcomProductCard';
import { useEcomProducts } from '../hooks/useEcomProducts';
import type { EcomPlatform } from '../types/ecom';

type SourceTab = 'ALL' | EcomPlatform;

const TABS: { label: string; value: SourceTab; color: string }[] = [
    { label: 'Tất cả', value: 'ALL', color: 'bg-brand-primary' },
    { label: 'Nhanh.vn', value: 'NHANH', color: 'bg-blue-500' },
    { label: 'Haravan', value: 'HARAVAN', color: 'bg-purple-500' },
];

const SkeletonCard: React.FC = () => (
    <div className="bg-white rounded-[22px] overflow-hidden animate-pulse">
        <div className="aspect-square bg-gray-100" />
        <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-100 rounded-full w-3/4" />
            <div className="h-3 bg-gray-100 rounded-full w-1/2" />
            <div className="h-4 bg-gray-100 rounded-full w-2/3" />
        </div>
    </div>
);

export const EcomStore: React.FC = () => {
    const [activeSource, setActiveSource] = useState<SourceTab>('ALL');
    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const { products, loading, error, refetch, hasData } = useEcomProducts({
        source: activeSource,
        keyword: keyword || undefined,
    });

    const handleSearch = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setKeyword(searchInput.trim());
    };

    const handleTabChange = (tab: SourceTab) => {
        setActiveSource(tab);
        setKeyword('');
        setSearchInput('');
    };

    return (
        <Page className="flex flex-col h-full bg-brand-cream relative">
            {/* Header */}
            <Header title="Cửa hàng" showBackIcon={false} className="sticky top-0 z-20" />

            <div className="px-5 pt-4 pb-3 bg-brand-cream sticky top-[44px] z-20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-primary rounded-xl flex items-center justify-center">
                            <Store size={16} className="text-white" />
                        </div>
                        <Text className="text-brand-dark font-bold text-lg">Cửa hàng</Text>
                    </div>
                    <button
                        onClick={refetch}
                        className={`p-2 rounded-xl transition-all ${loading ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary'}`}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                        <Input.Search
                            placeholder="Tìm kiếm sản phẩm..."
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onSearch={handleSearch}
                            clearable
                            className="w-full rounded-xl"
                        />
                    </div>
                </form>

                {/* Source Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => handleTabChange(tab.value)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${activeSource === tab.value
                                ? `${tab.color} text-white shadow-md`
                                : 'bg-white text-gray-500 border border-gray-100'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <Box className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar">
                {/* Error State */}
                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                            <AlertCircle size={24} className="text-red-400" />
                        </div>
                        <p className="text-gray-500 text-sm text-center">{error}</p>
                        <Button
                            onClick={refetch}
                            className="bg-brand-primary text-white rounded-xl"
                        >
                            Thử lại
                        </Button>
                    </div>
                )}

                {/* Loading Skeleton */}
                {loading && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && !hasData && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                            <Store size={28} className="text-gray-300" />
                        </div>
                        <p className="text-gray-400 text-sm text-center">
                            {activeSource === 'ALL'
                                ? 'Chưa kết nối nền tảng thương mại điện tử nào'
                                : `Không có sản phẩm từ ${activeSource === 'NHANH' ? 'Nhanh.vn' : 'Haravan'}`}
                        </p>
                    </div>
                )}

                {/* Product Grid */}
                {!loading && hasData && (
                    <>
                        <p className="text-gray-400 text-xs mb-3 pt-2">
                            {products.length} sản phẩm
                            {keyword && <span> &middot; Tìm: &quot;<span className="text-brand-primary">{keyword}</span>&quot;</span>}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {products.map(product => (
                                <EcomProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </>
                )}
            </Box>

            <BottomNav />
        </Page>
    );
};
