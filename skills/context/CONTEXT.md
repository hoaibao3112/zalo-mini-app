# Ngữ cảnh (Context)

Tập hợp các thông tin ngữ cảnh quan trọng cho việc phát triển, debug và tích hợp:

- Mục tiêu: cung cấp định nghĩa ngắn gọn về các thành phần hệ thống, luồng auth, và các ràng buộc an toàn.
- Đối tượng đọc: developer backend/frontend, AI assistant, QA.

Các chủ đề liên quan:

- Xác thực (Zalo Mini App): access token được cấp từ Zalo SDK; backend nên đặt `zalo_access_token` dưới dạng httpOnly cookie; kiểm tra token bằng `verifyZaloToken` middleware.
- Tenant scoping: mọi request đi qua đường dẫn `/api/t/:accountId` và được `resolveTenant` kiểm tra UUID và quyền truy cập.
- Caching: Redis dùng cho `verified_token`, `token_map`, và cache OA tokens; TTL ngắn (ví dụ 5 phút) cho verified tokens.
- Queue/Jobs: Bull/BullMQ dùng cho job asyn; cần chuẩn hóa kết nối Redis (dùng ioredis hoặc URL kết nối).
- Webhook: cần idempotency key + Redis SET NX để tránh xử lý trùng lặp.

Tham khảo file `DATA_STRUCTURES.md` để biết các mô tả kiểu dữ liệu.

## Lưu ý về các repository liên quan

Có hai repository khác kết nối trực tiếp với Zalo Mini App này — lưu ý khi thay đổi API hoặc schema:

- D:\\TrangWebCongTy\\warehouse-express — chứa logic kho, xử lý đơn hàng và endpoints POS liên quan.
- D:\\TrangWebCongTy\\sale-funnel — chứa các funnel bán hàng, redirect và endpoints bán hàng; kết nối và cấu hình cho tích hợp với Nhanh và Haravan (e-commerce/POS integrations).

Khi thay đổi contract API (đặc biệt endpoints order/express-packages, webhook hoặc auth), cập nhật cả hai repo trên và thông báo cho team tích hợp.