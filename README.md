# Whisk API Server - Hướng Dẫn Deploy

Web server bọc thư viện whisk-api để n8n workflow có thể gọi tạo ảnh AI miễn phí
bằng Google Imagen 3.5 (qua Whisk).

## Cấu trúc file

```
whisk-server/
├── server.js          # Web server chính (Express)
├── package.json       # Dependencies
├── Dockerfile         # Build Docker image
├── docker-compose.yml # Cho Coolify deploy
└── .dockerignore
```

## API Endpoints

### GET /health
Kiểm tra server sống.
Response: `{ "status": "ok", "hasCookie": true }`

### POST /generate
Tạo ảnh từ prompt.

Request body:
```json
{
  "prompt": "A dog sitting on the moon, hand-drawn editorial illustration style",
  "aspect_ratio": "LANDSCAPE",
  "seed": 0
}
```

Response (thành công):
```json
{
  "success": true,
  "image": "data:image/png;base64,iVBOR...(rất dài)...",
  "seed": 12345,
  "elapsed_ms": 8500
}
```

Response (thất bại, ví dụ bị content filter):
```json
{
  "success": false,
  "error": "API Error (400): ...",
  "elapsed_ms": 1200
}
```

Lưu ý: Server LUÔN trả HTTP 200 (kể cả khi lỗi). Phân biệt thành công/thất bại
bằng field `success`. Thiết kế này giúp n8n If node dễ xử lý.

### POST /update-cookie
Cập nhật cookie mới mà không cần restart server.

Request body:
```json
{
  "cookie": "your_new_cookie_string_here"
}
```

---

## HƯỚNG DẪN DEPLOY TỪNG BƯỚC

### Bước 1: Lấy Google Cookie

1. Mở Chrome trên máy tính cá nhân (KHÔNG phải server)
2. Đăng nhập tài khoản Google AI Pro
3. Cài extension "Cookie Editor":
   https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm

4. Vào trang: https://labs.google/fx/tools/whisk/project
   (Nếu trang báo "not available in your country", bật VPN sang US rồi vào lại.
    Chỉ cần VPN lúc lấy cookie, sau đó tắt VPN được.)

5. Đảm bảo trang Whisk load xong, bạn thấy giao diện tạo ảnh

6. Click icon Cookie Editor ở thanh Extensions
7. Click "Export" rồi chọn "Header String"
8. Paste vào notepad, đây là cookie bạn cần

   Cookie trông như thế này (rất dài, 1 dòng):
   __Secure-1PSID=g.a000abc...; __Secure-1PSIDTS=sidts-abc...; __Secure-3PSID=...

   LƯU Ý: KHÔNG chia sẻ cookie này cho bất kỳ ai.
   Nó giống như mật khẩu tài khoản Google của bạn.

### Bước 2: Tạo GitHub Repo

1. Vào github.com, đăng nhập
2. Click "New repository"
3. Tên repo: whisk-server
4. Chọn Private (quan trọng, vì bạn sẽ lưu code liên quan đến API)
5. Create repository
6. Upload 4 file: server.js, package.json, Dockerfile, docker-compose.yml, .dockerignore
   (hoặc dùng git push)

### Bước 3: Deploy trên Coolify

1. Mở Coolify dashboard
2. Click "Add Resource" hoặc "New" (tùy version Coolify)
3. Chọn "Application"
4. Source: chọn GitHub, trỏ tới repo whisk-server vừa tạo
5. Build Pack: chọn "Docker Compose"
   (hoặc "Dockerfile" nếu không dùng compose)

6. **Environment Variables** - thêm:
   - Key: `COOKIE`
   - Value: (paste cookie từ bước 1)
   - Key: `PORT`
   - Value: `3000`

7. **Domain/URL**: Trong phần Proxy/Domain settings:
   - Thêm domain: whisk-api.dbtaiyta.cfd
   - Port: 3000
   (config qua Pangolin reverse proxy giống bạn đã làm cho SketchReveal)

8. Click Deploy

### Bước 4: Test

Sau khi deploy xong, test bằng cách gọi:

```
curl https://whisk-api.dbtaiyta.cfd/health
```

Nếu thấy `{"status":"ok","hasCookie":true}` là thành công.

Test tạo ảnh:

```
curl -X POST https://whisk-api.dbtaiyta.cfd/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cute cat sitting on a windowsill, watercolor style"}'
```

Nếu thấy `{"success":true,"image":"data:image/png;base64,..."}` là hoàn thành.

---

## KHI COOKIE HẾT HẠN

Cookie Google thường sống vài ngày đến vài tuần. Khi hết hạn, server sẽ trả lỗi
kiểu "new cookie is required" hoặc "ACCESS_TOKEN_REFRESH_NEEDED".

Cách cập nhật (KHÔNG cần restart server):

```
curl -X POST https://whisk-api.dbtaiyta.cfd/update-cookie \
  -H "Content-Type: application/json" \
  -d '{"cookie": "your_new_cookie_here"}'
```

Hoặc: Vào Coolify, sửa biến môi trường COOKIE, rồi Redeploy.

---

## TROUBLESHOOTING

### Lỗi "API Error (403)" hoặc "ACCESS_TOKEN_REFRESH_NEEDED"
- Cookie hết hạn, cần lấy cookie mới (Bước 1)

### Lỗi "not a valid cookie"
- Cookie bị copy thiếu hoặc sai format
- Đảm bảo copy TOÀN BỘ chuỗi cookie, không thiếu ký tự

### Lỗi "content filtered" hoặc "safety" 
- Whisk từ chối prompt vì nội dung nhạy cảm (máu, bạo lực, etc.)
- Đây là lý do cần Replicate fallback trong workflow

### Server không khởi động
- Check Coolify logs
- Đảm bảo port 3000 không bị conflict
- Đảm bảo Dockerfile build thành công (npm install cần internet)

### Ảnh tạo chậm (>15 giây)
- Bình thường, Google Imagen cần 5-15 giây
- Nếu >30 giây, có thể do server location xa Google datacenter
