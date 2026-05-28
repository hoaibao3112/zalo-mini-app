import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full flex justify-center bg-gray-100">
      {/* 
        Updated Container:
        - Removed sm:border-[8px], sm:rounded-[40px], sm:my-auto (the phone frame styles).
        - Changed h-screen to h-[100dvh] for better mobile browser support (addresses URL bar resize).
        - Kept max-w-md to maintain mobile aspect ratio on desktop screens.
      */}
      <div className="w-full max-w-md h-[100dvh] bg-brand-cream overflow-hidden relative flex flex-col shadow-lg">
        {children}
      </div>
    </div>
  );
};