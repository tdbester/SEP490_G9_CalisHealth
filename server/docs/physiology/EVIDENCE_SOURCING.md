# Quy trình lấy nguồn học thuật cho Module Sinh lý Tập luyện

Tài liệu này quy định **nguồn nào được chấp nhận**, **lấy ở đâu**, và **quy trình kiểm chứng trước khi đưa vào hệ thống**.
Mục tiêu: mọi tuyên bố sinh lý trong CalisHealth đều truy được về một nguồn có thể tra cứu lại.

> **Không có ngoại lệ.** Nếu không tìm được nguồn cho một tuyên bố thì **không đưa tuyên bố đó vào hệ thống**.

---

## 1. Thứ tự ưu tiên khi tìm nguồn

Đi từ trên xuống. Dừng ở mức đầu tiên cho ra đủ dữ liệu.

| # | Nguồn | Cách tìm | Dùng cho |
|---|---|---|---|
| 1 | **Cơ sở dữ liệu tóm tắt học thuật có lọc theo loại nghiên cứu** | PubMed → filter *Review / Systematic Review / Meta-Analysis*; PMC | Tác động tim mạch, huyết áp, gân, nội tiết |
| 2 | **Hiệp hội chuyên môn — position stand / guideline** | Tra `ACSM position stand`, `WHO guidelines`, `NSCA`, `ISSN` | Tần số tập, tiến triển tải, an toàn tập |
| 3 | **Sách giáo khoc chuyên ngành (bản in)** | *ACSM's Guidelines for Exercise Testing and Prescription*, *NSCA Essentials of Strength Training and Conditioning* | Nguyên lý nền, cơ chế sinh lý |
| 4 | **Tạp chí bình duyệt (peer-reviewed)** | Journal of Strength and Conditioning Research, MSSE, BJSM, IJSPP, Sports Medicine | Nghiên cứu gốc, đo đạc cụ thể |
| 5 | **Cơ sở dữ liệu tóm tắt từ hiệp hội / viện nghiên cứu** | GSSI Sports Science Exchange, USOPC Sport Performance Institute | Áp dụng thực hành khi thiếu nghiên cứu gốc |

### Nguồn **KHÔNG** được chấp nhận

- Blog tập luyện, YouTube, TikTok, trang tư vấn fitness thương mại
- Tóm tắt AI (ChatGPT, Gemini, Copilot) — dùng để **tìm đường dẫn**, không dùng làm nguồn
- Wikipedia, blog khoa học không bình duyệt
- Tài liệu không có DOI/PMID, không có tên tạp chí, không có tác giả
- Tài liệu nội bộ của nhà sản xuất thiết bị tập (ngoại trừ khi công bố kèm phương pháp đo rõ ràng)

---

## 2. Quy tắc chấp nhận nguồn

Một nguồn được đưa vào `physiology_evidence` khi đáp ứng **đủ 4 điều kiện**:

1. **Định danh được** — có DOI hoặc PMID. Nguồn không có định danh không nhận.
2. **Có cơ sở thực nghiệm** — thử nghiệm có nhóm đối chứng, hoặc tổng quan hệ thống, hoặc đo đạc trên mẫu đủ lớn.
3. **Phát hành từ 2010 trở lại**, trừ trường hợp nguồn kinh điển định hình ngành (đánh dấu `evidence_grade = B` và ghi rõ lý do).
4. **Nội dung khớp với tuyên bố** — nghiên cứu thực sự đo đại lượng mà ta dùng, không suy diễn.

### Phân cấp bằng chứng

| Mức | Loại nghiên cứu | Ví dụ trong hệ thống |
|---|---|---|
| **A** | Systematic review, meta-analysis, position stand, guideline chính thức | ACSM 2009, Cornelissen 2011, JAHA 2012 |
| **B** | Controlled trial, IPD meta-analysis, nghiên cứu đo bằng catheter | Niewiadomski 2012 (Valsalva), Fleck 1985 (BP) |
| **C** | Nghiên cứu cắt ngang, đo mẫu đơn, tổng quan điển hình | Plank/wall sit 2026, GSSI 2011 |
| **D** | Narrative review, ý kiến chuyên gia | — (không dùng làm căn cứ duy nhất) |

> **Ngưỡng bắt buộc:** mọi hồ sơ bài tập phải có **ít nhất 1 nguồn mức A hoặc B**.
> Trong `V76__physiology_module.sql`, kiểm tra này được enforce bằng truy vấn:

```sql
-- Không hồ sơ nào được phép chỉ dựa vào nguồn mức C/D
SELECT p.exercise_id
FROM exercise_physiology_profiles p
JOIN JSON_TABLE(p.evidence_refs, '$[*]' COLUMNS(code VARCHAR(64) PATH '$')) jt
JOIN physiology_evidence e ON e.code = jt.code
GROUP BY p.exercise_id
HAVING SUM(CASE WHEN e.evidence_grade IN ('A', 'B') THEN 1 ELSE 0 END) = 0;
```

> Dùng `SUM(CASE WHEN grade IN ('A','B') ...)` chứ **không** dùng `MAX(grade)`:
> thứ tự chữ cái của `evidence_grade` không phản ánh thứ bậc chất lượng
> (`'C' > 'B'` về mặt chữ cái), nên `MAX` sẽ cho kết quả sai.

---

## 3. Quy trình 5 bước (làm theo đúng thứ tự)

### Bước 1 — Rút câu hỏi lâm sàng cụ thể

Không hỏi "bài plank có tốt cho tim mạch không" (quá rộng).
Hỏi: *"Trong thời gian giữ plank, huyết áp tâm thu đỉnh đạt bao nhiêu và có bao nhiêu người bị dừng vì giới hạn huyết áp tĩnh?"*

Câu hỏi cụ thể quyết định tài liệu nào đáp ứng.

### Bước 2 — Tìm bằng từ khóa có cấu trúc

Mẫu: `<đại lượng> + <loại bài tập> + <loại nghiên cứu>`

```
plank wall sit acute blood pressure response
isometric exercise blood pressure systematic review meta-analysis
tendon collagen synthesis timing post exercise recovery
acute chronic workload ratio injury risk
```

Dùng bộ lọc của PubMed: **Review → Systematic Review / Meta-Analysis**, năm ≥ 2010.

### Bước 3 — Đọc phần Abstract + Results, không chỉ đọc kết luận

Bắt buộc ghi lại:
- **Mẫu nghiên cứu** (n = ?)
- **Đối tượng** (người khỏe mạnh hay bệnh nhân?)
- **Phương pháp đo** (Finapres NOVA? catheter? ước lượng?)
- **Con số cụ thể** trích ra, kèm đơn vị và khoảng tin cậy nếu có

> Số đo từ nghiên cứu khác nhau **không so sánh trực tiếp được**. Ví dụ: plank và wall sit có đỉnh huyết áp gần nhau nhưng nghiên cứu khác về tạ có đỉnh 320/250 mmHg — **không được trộn hai nguồn thành một con số**.

### Bước 4 — Đối chiếu chéo

Mỗi tuyên bố quan trọng phải có **ít nhất 2 nguồn độc lập** cùng hướng.
Nếu 2 nguồn **mâu thuẫn** → **ghi cả hai vào hệ thống**, và nói rõ mức độ không chắc chắn.

Mẫu hợp đồng trong hệ thống là R3 (ACR):
- `EV_HAFF_2016` ủng hộ ngưỡng 0.8–1.3 / ≥1.5
- `EV_IMPELLIZZERI_2020` phản biện, kết luận **không có bằng chứng nhân quả**
- Thông điệp cảnh báo nói rõ: *"chỉ số này dùng để theo dõi tốc độ thay đổi tải, chưa có bằng chứng nhân quả để dùng dự đoán chấn thương"*

### Bước 5 — Ghi vào hệ thống

```sql
INSERT INTO physiology_evidence
  (code, title, authors, journal, year, doi, url, evidence_grade, study_type, summary)
VALUES (
  'EV_TANAKA_2001',
  'Age-predicted maximal heart rate revisited',
  'Tanaka M, Seals DR, Monahan KD, Craining PW',
  'Journal of Applied Physiology', 2001,
  '10.1152/japplphysiol.2001.89.3.1193',
  'https://pubmed.ncbi.nlm.nih.gov/11153730/',
  'A', 'Meta-analysis + cross-validation (18,712 subjects, 351 studies)',
  'Đề xuất công thức HRmax = 208 - 0.7 x tuổi ...'
);
```

`summary` phải nêu **nghiên cứu chứng minh điều gì**, không chỉ lặp lại tiêu đề.

Sau đó gắn vào hồ sơ bài tập và luật cảnh báo qua `evidence_refs` (JSON array các mã nguồn).

---

## 4. Kiểm chứng tự động

Chạy các truy vấn sau sau mỗi lần thêm/sửa bằng chứng:

```sql
-- (a) Không có trích dẫn treo
SELECT DISTINCT jt.code
FROM exercise_physiology_profiles p
JOIN JSON_TABLE(p.evidence_refs, '$[*]' COLUMNS(code VARCHAR(64) PATH '$')) jt
LEFT JOIN physiology_evidence e ON e.code = jt.code
WHERE e.code IS NULL;

-- (b) Không hồ sơ nào chỉ dựa vào nguồn mức C/D
SELECT p.exercise_id
FROM exercise_physiology_profiles p
JOIN JSON_TABLE(p.evidence_refs, '$[*]' COLUMNS(code VARCHAR(64) PATH '$')) jt
JOIN physiology_evidence e ON e.code = jt.code
GROUP BY p.exercise_id
HAVING MAX(e.evidence_grade) NOT IN ('A','B');

-- (c) Không luật cảnh báo nào thiếu nguồn
SELECT rule_code FROM physiology_alert_rules
WHERE evidence_refs IS NULL OR JSON_LENGTH(evidence_refs) = 0;
```

Cả 3 truy vấn phải trả về **0 dòng**.

---

## 5. Phân loại tuyên bố theo mức độ chắc chắn

Không phải mọi con số trong hệ thống cùng độ tin cậy. UI phải phân biệt:

| Nhóm | Ví dụ | Nhãn UI |
|---|---|---|
| **Đo trực tiếp** | Đỉnh SBP plank 177 ± 13 mmHg | *Đo trực tiếp trên 62 người* |
| **Suy ra từ cơ chế đã biết** | Co tĩnh → nghẽn mạch ngoại vi → tăng huyết áp | *Suy ra từ cơ chế* |
| **Ước tính theo công thức** | Dải %HRmax theo Tanaka 2001 | *Ước tính theo HRmax dự kiến* |
| **Khuyến nghị định tính** | "Nên ăn bữa chính 3-4 giờ trước tập" | *Khuyến nghị chung* |

**Không bao giờ hiển thị một con số ước tính mà không ghi nhãn.** Đây là ranh giới giữa "hệ thống hỗ trợ tập luyện" và "hệ thống chẩn đoán y tế".

---

## 6. Ranh giới trách nhiệm (bắt buộc hiển thị trong UI)

Module sinh lý là **thông tin mang tính giáo dục và tự theo dõi**, không phải chẩn đoán.

- Mọi giá trị trong `exercise_physiology_profiles` là **dữ liệu khai báo/suy luận**, không phải số đo thiết bị.
- Hệ thống **không** đo nhịp tim, huyết áp, đường huyết.
- Triệu chứng đỏ (ngất, đau ngực, tim đập loạn, chóng mặt kéo dài) → **chuyển hướng đi khám**, không đưa lời khuyên tập.
- Bài có `contraindications` khớp với hồ sơ sức khoẻ của member → **cảnh báo chặn**, không chỉ gợi ý.

---

## 7. Danh mục nguồn hiện có (21 nguồn)

Xem trực tiếp trong DB:

```sql
SELECT code, evidence_grade, study_type, year, title, doi
FROM physiology_evidence
ORDER BY evidence_grade, year;
```

| Mã | Nguồn | Mức | Dùng cho |
|---|---|---|---|
| EV_ACSM_2009 | ACSM Position Stand, MSSE 2009 | A | Tần số tập, tăng tải 2-10% |
| EV_CORNELISSEN_2011 | Cornelissen, Hypertension 2011 | A | Tác động BP động vs tĩnh |
| EV_JAHA_2012 | Hamer, JAHA 2012 | A | SBP/DBP theo loại tập |
| EV_ACWR_SYSREV | Impellizzeri, Sports Medicine 2020 | A | ACWR định nghĩa + giới hạn |
| EV_IMPELLIZZERI_2020 | Impellizzeri, IJSPP 2020 | A | **Phản biện** ACWR |
| EV_HAFF_2016 | Haff & Triplett, BJSM 2016 | A | Ngưỡng ACR 0.8-1.3 / ≥1.5 |
| EV_FOSTER_1998 | Foster, MSSE 1998 | A | Load / monotony / strain, ngưỡng cá nhân |
| EV_FOSTER_2001 | Foster, JSCR 2001 | A | Session-RPE × thời lượng |
| EV_TANAKA_2001 | Tanaka, J Appl Physiol 2001 | A | HRmax = 208 − 0.7×tuổi |
| EV_NETMETA_2023 | Network meta-analysis, 2023 | A | BP aerobic/ HIIT/ resistance |
| EV_ISO_BP_META_2024 | Isometric BP meta-analysis 2024 | A | Khác biệt theo loại bài isometric |
| EV_TENDON_2020 | Mersmann, Sports Medicine 2020 | A | Gân thích ứng chậm hơn cơ |
| EV_CONNECTIVE_2019 | Kaufmann, Ger J Sports Med 2019 | A | Cơ chế collagen → độ cứng gân |
| EV_USOPC_2025 | USOPC Tendinopathy Manual 2025 | A | Collagen đỉnh 24h, cần nghỉ 24h |
| EV_GI_2019 | Salamone, Front Physiol 2019 | A | Splanchnic giảm 80%, ăn no 1-2h trước |
| EV_GLUT4_2021 | Kammoun, Diabetologia 2021 | A | Nhạy insulin 24-48h sau tập |
| EV_GLUT4_2016 | Humphreys, Nat Rev Endocrinol 2016 | A | Cơ chế AMPK/RAC1 → GLUT4 |
| EV_NIEWIADOMSKI_2012 | Niewiadomski, 2012 | B | Valsalva tăng peak BP |
| EV_FLECK_1985 | Fleck, MSSE 1985 | B | BP theo effort, không theo lực |
| EV_PLANK_2026 | J Hypertens 2026 (plank/wall sit) | C | Đỉnh SBP 177/189, DBP >115 ở ~50s |
| EV_GI_GSSI | GSSI SSE 114 | C | Ăn 3-4h trước, tránh mỡ/xơ |

---

## 8. Bảo trì

- Nguồn mới được thêm bằng `INSERT` vào `physiology_evidence` trong migration mới (không sửa migration đã apply).
- Khi một tuyên bố bị gỡ khỏi UI, **giữ nguyên** dòng bằng chứng và chỉ bỏ reference khỏi hồ sơ — để lịch sử trích dẫn còn tra được.
- Nếu một nguồn bị **rút lại (retracted)**: đặt `evidence_grade = 'D'`, ghi rõ trong `summary`, và tìm nguồn thay thế cho mọi hồ sơ đang trích dẫn nó.
