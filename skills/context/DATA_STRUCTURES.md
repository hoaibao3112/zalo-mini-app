# Cấu trúc dữ liệu chính

Tài liệu này mô tả các thực thể (entities) quan trọng và các trường thường dùng trong hệ thống.

## Customer
- `id: string` — UUID
- `accountId: string` — tenant id
- `zaloId: string | null` — id của user trên Zalo (nếu có)
- `name: string`
- `avatar: string | null`
- `phone: string | null`
- `gender: number | null` — 0 = nữ, 1 = nam
- `birthday: string | null` — ISO date
- `source: 'MINIAPP' | 'POS' | ...`

## ZaloOA (OA account)
- `id: string`
- `oaId: string` — Zalo OA ID
- `accountId: string`
- `accessToken: string` — **mã hoá trong DB** hoặc lưu an toàn
- `refreshToken: string`
- `tokenExpiresAt: Date`

## Token cache entries (Redis keys)
- `zalo_mini_app:verified_token:<hash>` -> JSON {
  - `zaloId`, `customerId`, `customerName`, `accountId`
  }
- `zalo_mini_app:token_map:<accountId>:<zaloId>` -> JSON { `id`, `zaloId`, `accountId`, `name` }
- TTL đề xuất: 300s (5 phút) cho verified_token

## Webhook Event
- `eventId: string` — id duy nhất từ Zalo
- `type: string` — event type
- `payload: object` — nội dung sự kiện
- Dedupe key (Redis): `zalo_mini_app:webhook_event:<eventId>` sử dụng `SET NX EX <ttl>`

## Order / Package Order
- `orderId: string`
- `customerId: string`
- `items: Array<{productId, quantity, price}>`
- `total: number`
- `status: string`
- `idempotencyKey?: string`

## SpinGame / SpinCredit / SpinReward
- `gameId`, `customerId`, `credits`, `rewards`, `status`

---

Ghi chú:
- Giữ các mô tả ngắn gọn, cập nhật khi schema DB thay đổi.
- Nếu cần, mở rộng từng phần thành file `.md` riêng cho domain (e.g., `customers.md`, `orders.md`).