const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

const HTML_ESCAPE_REGEX = /[&<>"'`=/]/g;

export function escapeHtml(input: string): string {
    return input.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function normalizeWhitespace(input: string): string {
    return input.trim().replace(/\s+/g, ' ');
}

export function sanitizeText(input: string): string {
    return escapeHtml(normalizeWhitespace(input));
}

export function sanitizeUrl(input: string): string | null {
    try {
        const parsed = new URL(input.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

export const sanitizeTextTransformer = (val: string): string => sanitizeText(val);

export const sanitizeUrlTransformer = (val: string): string => sanitizeUrl(val) ?? '';
