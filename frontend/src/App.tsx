import React, { createContext, useContext, useState } from 'react';
import { App as ZMPApp, ZMPRouter, SnackbarProvider, AnimationRoutes } from 'zmp-ui';
import { Route } from 'react-router-dom';
import 'zmp-ui/zaui.css';
import './css/app.css';

// Import pages
import { Home } from './pages/Home';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { Favorites } from './pages/Favorites';
import { Profile } from './pages/Profile';
import { ProductDetail } from './pages/ProductDetail';
import { SpinGamePage } from './pages/SpinGamePage';
import { EcomStore } from './pages/EcomStore';
import { EcomProductDetail } from './pages/EcomProductDetail';
import { ExpressPackagesPage } from './pages/ExpressPackagesPage';
import { PackageOrdersPage } from './pages/PackageOrdersPage';


import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// ==========================================
// App Router
// ==========================================
export default function App() {
    return (
        <ZMPApp>
            <SnackbarProvider>
                <ZMPRouter>
                    <AuthProvider>
                    <CartProvider>
                        {/* 
                            ZMPRouter supports animation natively. 
                            We don't strictly need <Layout> if ZMP-UI provides standard bottom nav,
                            but we can keep existing logic for now if it doesn't break zmp-ui pages.
                        */}
                        <AnimationRoutes>
                            {/* Internal store */}
                            <Route path="/" element={<Home />} />
                            <Route path="/product/:id" element={<ProductDetail />} />
                            <Route path="/cart" element={<Cart />} />
                            <Route path="/orders" element={<Orders />} />
                            <Route path="/favorites" element={<Favorites />} />
                            <Route path="/profile" element={<Profile />} />
                            
                            {/* ExpressCafe POS Integration */}
                            <Route path="/express-packages" element={
                                <ErrorBoundary>
                                    <ExpressPackagesPage />
                                </ErrorBoundary>
                            } />
                            <Route path="/package-orders" element={
                                <ErrorBoundary>
                                    <PackageOrdersPage />
                                </ErrorBoundary>
                            } />

                            
                            {/* Gamification */}
                            <Route path="/game" element={
                                <ErrorBoundary>
                                    <SpinGamePage />
                                </ErrorBoundary>
                            } />

                            {/* E-commerce (Nhanh.vn + Haravan) */}
                            <Route path="/ecom" element={
                                <ErrorBoundary>
                                    <EcomStore />
                                </ErrorBoundary>
                            } />
                            <Route path="/ecom/:platform/:id" element={
                                <ErrorBoundary>
                                    <EcomProductDetail />
                                </ErrorBoundary>
                            } />
                        </AnimationRoutes>
                    </CartProvider>
                    </AuthProvider>
                </ZMPRouter>
            </SnackbarProvider>
        </ZMPApp>
    );
}
