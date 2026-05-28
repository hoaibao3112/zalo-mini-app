/**
 * Chuẩn hóa số điện thoại Việt Nam về định dạng 10 chữ số bắt đầu bằng 0
 */
export function normalizePhoneNumber(phone: string): string {
    if (!phone) return phone;
    
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+84')) {
        cleaned = '0' + cleaned.slice(3);
    } 
    else if (cleaned.startsWith('84') && cleaned.length > 9) {
        cleaned = '0' + cleaned.slice(2);
    }
    
    return cleaned;
}
