import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface PopupData {
    id: string;
    title: string;
    image: string;
    linkType: string | null;
    linkValue: string | null;
}

export function PopupModal() {
    const navigate = useNavigate();
    const [popup, setPopup] = useState<PopupData | null>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        loadPopup();
    }, []);

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
                    className="rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
                    onClick={handleClick}
                >
                    <img
                        src={popup.image}
                        alt={popup.title}
                        className="w-full aspect-square object-cover"
                    />
                </div>
            </div>
        </div>
    );
}
