# Zalo Mini App

Dự án Zalo Mini App (frontend + backend) cung cấp các API và UI chạy trong Zalo Mini Program.

## Cấu trúc thư mục
- `/frontend`: Mã nguồn ứng dụng Zalo Mini App (React + Vite + TailwindCSS + Konsta UI). Tạo artefact ở `frontend/www` để đóng gói cho Zalo.
- `/backend`: Backend TypeScript (Express + Prisma + Redis) cung cấp API, webhook và worker.
- `/skills`: tài liệu nội bộ, context và mô tả cấu trúc dữ liệu (dùng cho onboard/AI).

## Tích hợp với các hệ thống khác
Project này tương tác trực tiếp với hai repository/service ngoài:

- `D:\TrangWebCongTy\sale-funnel` — chứa funnel bán hàng, redirect và các cấu hình tích hợp với hệ thống e‑commerce/ POS như Nhanh và Haravan. Khi thay đổi API liên quan tới order, express-packages hoặc webhook, phải đồng bộ thay đổi ở `sale-funnel`.
- `D:\TrangWebCongTy\warehouse-express` — chứa logic kho, xử lý đơn hàng và endpoints POS; cập nhật nếu thay đổi contract order/stock APIs.

Lưu ý: bất kỳ thay đổi contract (payload/endpoint) trong backend của Zalo Mini App cần thông báo và cập nhật trong hai repo trên.

## Cấu hình môi trường quan trọng
- `DATABASE_URL` — PostgreSQL connection (Prisma)
- `REDIS_URL` — Redis connection (caching, locks, queues)
- `VITE_API_HOST` — frontend: base URL backend (development)
- `VITE_TENANT_SLUG` — tenant mặc định cho frontend (dev)
- `SALE_FUNNEL_BACKEND_URL` — URL tới service `sale-funnel` nếu cần proxy

## Build & Deploy (tóm tắt)
- Backend: `npm run build` (trong `/backend`) → output `dist/`
- Frontend: `npm run build` (trong `/frontend`) → output `frontend/www`
- Docker compose production: `docker-compose.prod.yml` có cấu hình multi-service (backend, worker, nginx...).

## Kiểm tra nhanh trước deploy
- Đồng bộ contract với `sale-funnel` và `warehouse-express` khi thay đổi:
	- endpoints: `/orders`, `/express-packages`, webhooks
	- auth: cookie `zalo_access_token` contract
- Chạy build frontend/backend và kiểm tra `frontend/www/app-config.json` trước khi đóng gói.

## Thông tin thêm
Xem thêm `skills/context/CONTEXT.md` và `skills/context/DATA_STRUCTURES.md` để biết cấu trúc dữ liệu và lưu ý tích hợp.

---
If you want, I can also generate a checklist of endpoints and payloads to verify across `sale-funnel` and `warehouse-express`.
