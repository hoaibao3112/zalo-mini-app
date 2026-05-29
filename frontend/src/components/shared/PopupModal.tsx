import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface PopupData {
    id: string;
    title: string;
    image: string;
    linkType: string | null;
    linkValue: string | null;
}

function removeGreenBackground(imageUrl: string): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(imageUrl);
                return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Bright green background color: #7AD65B (R: 122, G: 214, B: 91)
            const targetR = 122;
            const targetG = 214;
            const targetB = 91;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                
                const distance = Math.sqrt(
                    Math.pow(r - targetR, 2) + 
                    Math.pow(g - targetG, 2) + 
                    Math.pow(b - targetB, 2)
                );
                
                if (distance < 95) { // Match a generous range of lime green
                    data[i+3] = 0; // Set alpha to fully transparent
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            resolve(imageUrl);
        };
        img.src = imageUrl;
    });
}

export function PopupModal() {
    const navigate = useNavigate();
    const [popup, setPopup] = useState<PopupData | null>(null);
    const [show, setShow] = useState(false);
    const [processedImage, setProcessedImage] = useState<string>('');

    useEffect(() => {
        loadPopup();
    }, []);

    useEffect(() => {
        if (popup && popup.image) {
            const imgSrc = popup.image.startsWith('http') && (popup.image.includes('unsplash') || popup.image.includes('photo-')) 
                ? '/images/lucky-wheel-banner.png' 
                : popup.image;
            removeGreenBackground(imgSrc).then(setProcessedImage);
        }
    }, [popup]);

    async function loadPopup() {
        try {
            // Kiểm tra xem đã hiển thị popup trong session này chưa
            // Dùng sessionStorage thay vì localStorage để mỗi lần mở app sẽ hiển thị lại
            const shownThisSession = sessionStorage.getItem('popup_shown');

            if (shownThisSession) {
                return; // Đã hiển thị trong session này rồi
            }

            const data = await api.getActivePopup();
            if (data) {
                setPopup(data);
                setShow(true);
                sessionStorage.setItem('popup_shown', 'true');
            }
        } catch (error) {
            console.error('Error loading popup:', error);
        }
    }

    function handleClick() {
        if (!popup) return;

        if (popup.linkType === 'game' && popup.linkValue) {
            navigate('/game');
        } else if (popup.linkType === 'product' && popup.linkValue) {
            navigate(`/product/${popup.linkValue}`);
        } else if (popup.linkType === 'url' && popup.linkValue) {
            window.open(popup.linkValue, '_blank');
        }

        setShow(false);
    }

    if (!show || !popup) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShow(false)}
        >
            <div
                className="relative max-w-sm w-full animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => setShow(false)}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700 z-10"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                <div
                    className="overflow-hidden cursor-pointer bg-transparent"
                    onClick={handleClick}
                >
                    <img
                        src={processedImage || (popup.image.startsWith('http') && (popup.image.includes('unsplash') || popup.image.includes('photo-')) ? '/images/lucky-wheel-banner.png' : popup.image)}
                        alt={popup.title}
                        className="w-full h-auto object-contain bg-transparent block"
                    />
                </div>
            </div>
        </div>
    );
}
