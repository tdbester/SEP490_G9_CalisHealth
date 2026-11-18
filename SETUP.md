# Setup local — làm đúng theo thứ tự này

Tài liệu này dành cho **thành viên mới pull code về**. Mục tiêu: mọi máy chạy được
giống nhau, không gặp lỗi khi start.

> Nếu bạn chỉ cần chạy nhanh, làm đúng 6 bước ở mục [Làm nhanh](#làm-nhanh-6-bước).

---

## Yêu cầu

| Công cụ | Phiên bản | Ghi chú |
|---------|-----------|---------|
| JDK | **17** | Spring Boot 4 cần JDK 17+ |
| Maven | tự động | Dùng `mvnw` (wrapper) trong `server/`, không cần cài |
| Node.js | **20+** | Chỉ cho frontend |
| MySQL | **8.0+** | Chạy local, không cần Docker |

Kiểm tra nhanh:

```bash
java -version     # phải ra 17 hoặc cao hơn
node --version    # phải ra v20 trở lên
mysql --version
```

---

## Làm nhanh (6 bước)

### 1. Clone code

```bash
git clone https://github.com/tdbester/SEP490_G9_CalisHealth.git
cd SEP490_G9_CalisHealth
```

Nếu bạn đã có repo và vừa có bản cập nhật:

```bash
git pull
```

### 2. Tạo file `.env` từ mẫu

```bash
cp .env.example .env
```

> **Không bỏ qua bước này.** Backend đọc `.env` ở thư mục gốc repo. Không có
> file này thì backend vẫn chạy (nhờ giá trị mặc định trong `application.yml`),
> nhưng sẽ không có key AI / Cloudinary.

### 3. (Tuỳ chọn) Điền key thật vào `.env`

File `.env` **đã có sẵn giá trị mặc định để demo chạy được ngay**:

| Biến | Mặc định trong `.env.example` | Trạng thái |
|------|-------------------------------|------------|
| `DB_USERNAME` | `root` | dùng được |
| `DB_PASSWORD` | `12345678` | dùng được (khớp `application.yml`) |
| `JWT_SECRET` | khóa demo 51 ký tự | dùng được |
| `CLOUDINARY_*` | rỗng | **rỗng = lưu media trên ổ đĩa local**, vẫn demo được |
| `GEMINI_API_KEY` | rỗng | rỗng = AI Support trả lời bằng rule nội bộ, vẫn demo được |
| `OPENAI_API_KEY` | rỗng | rỗng = AI Support dùng demo fallback |
| `MAIL_*` | rỗng | rỗng = tắt gửi mail (đặt lại mật khẩu), app vẫn chạy |

Muốn dùng tính năng thật thì điền key vào `.env`:

```bash
# Gemini (free tier) — lấy key tại https://aistudio.google.com/apikey
GEMINI_API_KEY=AIza...

# Cloudinary — lấy ở dashboard Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# SMTP (gmail) — dùng cho đặt lại mật khẩu
MAIL_USERNAME=...
MAIL_PASSWORD=...
```

**Quan trọng:** `.env` đã được `.gitignore`, **không bao giờ commit lên Git.**
Nếu lỡ commit, sửa ngay bằng `git rm --cached .env`.

### 4. Tạo database

Backend tự tạo database và chạy migration (Flyway) khi start, nên **không cần
import file SQL nào**. Chỉ cần MySQL đang chạy và tài khoản `root` truy cập được.

Kiểm tra MySQL đã chạy chưa:

```bash
mysql -u root -p -e "SELECT 1;"
```

Nếu đổi mật khẩu root MySQL local thì sửa `DB_PASSWORD` trong `.env` cho khớp.

### 5. Chạy backend

```bash
cd server
./mvnw spring-boot:run        # Windows: .\mvnw.cmd spring-boot:run
```

Lần đầu sẽ mất khoảng 30–60 giây (tải dependency + chạy 82 migration).
Thấy dòng này là thành công:

```
Started CalisHealthApplication in XX seconds
```

Kiểm tra API: <http://localhost:8080/actuator/health> → `{"status":"UP"}`

Swagger UI: <http://localhost:8080/swagger-ui.html>

### 6. Chạy frontend

Mở terminal thứ hai:

```bash
cd client
npm install
npm run dev
```

Mở <http://localhost:5173>.

Frontend **không cần** file `.env` — nếu `VITE_API_URL` không có thì code tự mặc
định `http://localhost:8080/api` (xem `client/src/api/client.js`).

---

## Tài khoản demo có sẵn

Các tài khoản dưới đây được **seed bằng migration** nên có trên mọi máy ngay
sau khi start lần đầu (không cần import SQL thủ công).

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| `admin@calishealth.com` | `Test@123` | ADMIN — khu vực quản trị |
| `dashboard.beginner@calishealth.com` | `123456` | MEMBER — dữ liệu mẫu dashboard |
| `dashboard.intermediate@calishealth.com` | `123456` | MEMBER — dữ liệu mẫu dashboard |
| `dashboard.advanced@calishealth.com` | `123456` | MEMBER — dữ liệu mẫu dashboard |

> Đăng ký member mới cũng được nhưng tài khoản mới sẽ **chưa có dữ liệu mẫu**
> (không có bài tập, chương trình tập, điểm leaderboard). Để demo đầy đủ thì
> dùng tài khoản seed sẵn.

---

## Xử lý sự cố

### `Access denied for user 'root'@'localhost' (using password: NO)`

Sai mật khẩu MySQL. Kiểm tra:

```bash
mysql -u root -p -e "SELECT 1;"
```

Sửa `DB_PASSWORD` trong `.env` cho khớp với mật khẩu MySQL của bạn.

> Lỗi này xảy ra khi `DB_PASSWORD` trong `.env` để **trống** — biến rỗng sẽ ghi
> đè giá trị mặc định trong `application.yml`.

### `WeakKeyException: The specified key byte array is 0 bits`

`JWT_SECRET` trong `.env` để trống. Sửa thành:

```
JWT_SECRET=clh-demo-secret-key-please-change-this-32-chars-min
```

### App start nhưng đăng nhập lỗi 500

Thường do `JWT_SECRET` rỗng (xem trên) hoặc MySQL không truy cập được.

### `/actuator/health` trả 503 dù app vẫn chạy

Đã được xử lý trong code (xem `server/src/main/java/com/calishealth/config/MailHealthIndicator.java`).
Trường hợp này xảy ra khi SMTP chưa cấu hình — `MailHealthIndicator` mặc định của
Spring Boot đánh dấu DOWN. App đã có indicator riêng: chưa cấu hình SMTP thì báo
UP (vì chức năng gửi mail có fallback sang console log).

Nếu vẫn thấy 503, kiểm tra MySQL:

```bash
curl http://localhost:8080/actuator/health
```

### `Port 8080 was already in use`

Có instance khác đang chạy. Đóng cửa sổ terminal cũ, hoặc đổi port:

```bash
cd server
./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

Nhớ sửa `VITE_API_URL` trong `client/.env.local` cho khớp port mới.

### Lỗi `Failed to obtain connection from database` khi chạy test

Test suite cần MySQL thật (không dùng H2 vì SQL migration viết cho MySQL).
Đảm bảo MySQL đang chạy trước khi chạy test.

### Frontend báo lỗi kết nối API

- Backend đã chạy chưa? Kiểm tra <http://localhost:8080/actuator/health>
- Port có khớp không? Mặc định frontend gọi `http://localhost:8080/api`.

### Muốn xoá sạch DB để chạy lại từ đầu

```bash
mysql -u root -p -e "DROP DATABASE calishealth; CREATE DATABASE calishealth;"
```

Lần start sau Flyway tự chạy lại toàn bộ 82 migration.

---

## Chạy test

```bash
cd server
./mvnw test          # Windows: .\mvnw.cmd test
```

Cần MySQL đang chạy. Test hiện có **367 test**.

Frontend:

```bash
cd client
npm run test:tracker
```

---

## Vì sao lỗi này không lặp lại nữa

Repo này **không dùng GitHub Actions (CI)**. Chất lượng được bảo đảm thủ công:
điều kiện tối thiểu trước khi push là

```bash
cd server && ./mvnw test        # 367 test backend, cần MySQL đang chạy
cd client && npm ci && npm run build
```

Lưu ý cho môi trường Linux/CI khác: `server/mvnw` phải có quyền thực thi
(`git update-index --chmod=+x server/mvnw`), nếu không sẽ báo `./mvnw: Permission denied`.
Với `npm`, luôn dùng `npm ci` để bắt lỗi lockfile lệch với `package.json`
(`npm install` sẽ tự vá và che mất lỗi này).
