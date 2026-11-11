-- V76: Module sinh lý tập luyện — thư viện bằng chứng, hồ sơ sinh lý bài tập, luật cảnh báo.
--
-- MỤC TIÊU
--   Gắn mọi tuyên bố sinh lý trong hệ thống với một nguồn học thuật có thể tra cứu.
--   Không có giá trị nào trong bảng hồ sơ sinh lý mà không truy được về nguồn.
--
-- BA BẢNG
--   1. physiology_evidence      — thư viện bằng chứng (mỗi dòng = 1 nghiên cứu/guideline)
--   2. exercise_physiology_profiles — hồ sơ sinh lý của từng bài tập (1-1 với exercises)
--   3. physiology_alert_rules    — luật cảnh báo, mỗi luật trích dẫn bằng chứng
--
-- NGUYÊN TẮC
--   - Đây là DỮ LIỆU KHAI BÁO của bài tập, KHÔNG phải số đo thiết bị.
--   - Mọi giá trị sinh lý đều là ước tính/suy luận, UI phải gắn nhãn tương ứng.
--   - Member KHÔNG nhập bảng này. Bài do member tạo -> copy hồ sơ mặc định theo
--     category + difficulty_level (xem ExercisePhysiologyService).
--
-- MỨC BẰNG CHỨNG (evidence_grade)
--   A = systematic review / meta-analysis / position stand / guideline
--   B = controlled trial / individual participant data meta-analysis
--   C = nghiên cứu đo cắt ngang / tổng quan điển hình
--   D = narrative review / ý kiến chuyên gia

-- ============================================================
-- 1. THƯ VIỆN BẰNG CHỨNG
-- ============================================================
CREATE TABLE IF NOT EXISTS physiology_evidence (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    -- Mã nghiệp vụ dùng để tham chiếu (VD: EV_TANAKA_2001). UNIQUE để seed idempotent.
    code            VARCHAR(64)  NOT NULL,
    title           VARCHAR(400) NOT NULL,
    -- Tác giả (giữ dạng chuỗi đơn giản, không cần bảng tác giả riêng).
    authors         VARCHAR(300) DEFAULT NULL,
    journal         VARCHAR(200) DEFAULT NULL,
    year            SMALLINT     DEFAULT NULL,
    doi             VARCHAR(200) DEFAULT NULL,
    url             VARCHAR(500) DEFAULT NULL,
    -- A | B | C | D
    evidence_grade  CHAR(1)      NOT NULL DEFAULT 'C',
    -- Loại nghiên cứu, VD: "Meta-analysis", "Position stand", "Cross-sectional".
    study_type      VARCHAR(80)  DEFAULT NULL,
    -- Tóm tắt tiếng Việt: nghiên cứu này chứng minh điều gì, dùng cho trường nào.
    summary         TEXT         DEFAULT NULL,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_physio_evidence_code (code),
    KEY idx_physio_evidence_grade (evidence_grade),
    CONSTRAINT ck_physio_evidence_grade CHECK (evidence_grade IN ('A','B','C','D'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. HỒ SƠ SINH LÝ CỦA BÀI TẬP
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_physiology_profiles (
    exercise_id             BIGINT       NOT NULL,

    -- ISOMETRIC (giữ cơ co, không đổi chiều) | STATIC (không nhúc nhích) | DYNAMIC (co giãn liên tục)
    contraction_type        VARCHAR(20)  NOT NULL DEFAULT 'DYNAMIC',
    -- Độ dài đòn cân bằng 1..5: 1 = gần điểm đổi trục (push-up), 5 = xa nhất (front lever).
    lever_grade             TINYINT      NOT NULL DEFAULT 3,
    -- Tải tim mạch 1..5.
    cardiovascular_load     TINYINT      NOT NULL DEFAULT 3,
    -- Dải %HRmax ước tính (theo Tanaka 2001). Chỉ là ước tính, không đo.
    hr_zone_low             TINYINT      NOT NULL DEFAULT 60,
    hr_zone_high            TINYINT      NOT NULL DEFAULT 80,
    -- LOWERS | NEUTRAL | RAISES | SPIKE_RISK
    blood_pressure_effect   VARCHAR(20)  NOT NULL DEFAULT 'NEUTRAL',
    -- NONE | LOW | MODERATE | HIGH — nguy cơ nín thở (Valsalva).
    valsalva_risk           VARCHAR(20)  NOT NULL DEFAULT 'LOW',
    -- NONE | LOW | MODERATE | HIGH — rủi ro tiêu hoá.
    gi_risk                 VARCHAR(20)  NOT NULL DEFAULT 'LOW',
    -- Tải gân 1..5. Gân thích ứng chậm hơn cơ -> đây là nút thắt thật sự.
    tendon_load             TINYINT      NOT NULL DEFAULT 3,
    -- Khớp chịu tải chính: WRIST | ELBOW | SHOULDER | SPINE | HIP | KNEE | ANKLE
    primary_joint           VARCHAR(20)  NOT NULL DEFAULT 'KNEE',
    -- Câu nhắc thở cho voice coach / AI Support.
    breathing_cue           VARCHAR(150) DEFAULT NULL,
    -- JSON array: ["hypertension","glaucoma",...]
    contraindications       JSON         DEFAULT NULL,
    -- Ghi chú cho member đọc ở màn chi tiết bài.
    physiology_note         TEXT         DEFAULT NULL,
    -- JSON array các mã physiology_evidence dùng để suy ra hồ sơ này.
    -- Bắt buộc có ít nhất 1 nguồn -> không có tuyên bố sinh lý nào mà không tra được.
    evidence_refs           JSON         DEFAULT NULL,

    updated_at              DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                       ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (exercise_id),
    KEY idx_physio_contraction (contraction_type),
    KEY idx_physio_tendon (tendon_load),
    CONSTRAINT fk_physio_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_physio_lever    CHECK (lever_grade BETWEEN 1 AND 5),
    CONSTRAINT ck_physio_cv_load  CHECK (cardiovascular_load BETWEEN 1 AND 5),
    CONSTRAINT ck_physio_tendon   CHECK (tendon_load BETWEEN 1 AND 5),
    CONSTRAINT ck_physio_hr       CHECK (hr_zone_low BETWEEN 30 AND 95
                                      AND hr_zone_high BETWEEN hr_zone_low AND 100),
    CONSTRAINT ck_physio_contraction CHECK (contraction_type IN ('DYNAMIC','ISOMETRIC','STATIC')),
    CONSTRAINT ck_physio_bp       CHECK (blood_pressure_effect IN ('LOWERS','NEUTRAL','RAISES','SPIKE_RISK')),
    CONSTRAINT ck_physio_risk     CHECK (valsalva_risk IN ('NONE','LOW','MODERATE','HIGH')
                                      AND gi_risk IN ('NONE','LOW','MODERATE','HIGH'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. LUẬT CẢNH BÁO
-- ============================================================
-- Mỗi luật = một điều kiện có thể kiểm tra bằng dữ liệu hệ thống đang có,
-- kèm thông điệp và trích dẫn. Content Manager / Admin bật tắt được.
CREATE TABLE IF NOT EXISTS physiology_alert_rules (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    rule_code       VARCHAR(64)  NOT NULL,
    title           VARCHAR(200) NOT NULL,
    -- Mô tả điều kiện kích hoạt bằng lời (để người đọc hiểu, không phải để máy chạy).
    condition_desc  VARCHAR(400) NOT NULL,
    -- Thông điệp hiển thị cho member.
    message_template TEXT        NOT NULL,
    -- INFO | WARN | DANGER
    severity        VARCHAR(10)  NOT NULL DEFAULT 'INFO',
    -- JSON array các mã bằng chứng.
    evidence_refs   JSON         DEFAULT NULL,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                   ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_physio_rule_code (rule_code),
    CONSTRAINT ck_physio_rule_severity CHECK (severity IN ('INFO','WARN','DANGER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED THƯ VIỆN BẰNG CHỨNG
-- ============================================================
-- REPLACE INTO dùng thay cho INSERT ... ON DUPLICATE KEY UPDATE vì MySQL 8.0.19+
-- đã bỏ cú pháp VALUES() trong mệnh đề UPDATE (và cú pháp alias chưa được Flyway
-- phân tích ổn định). Bảng này không có FK nào trỏ tới nên REPLACE an toàn.
REPLACE INTO physiology_evidence
    (code, title, authors, journal, year, doi, url, evidence_grade, study_type, summary)
VALUES
('EV_TANAKA_2001',
 'Age-predicted maximal heart rate revisited',
 'Tanaka M, Seals DR, Monahan KD, Craining PW',
 'Journal of Applied Physiology', 2001,
 '10.1152/japplphysiol.2001.89.3.1193',
 'https://pubmed.ncbi.nlm.nih.gov/11153730/',
 'A', 'Meta-analysis + cross-validation (18,712 subjects, 351 studies)',
 'Đề xuất công thức HRmax = 208 - 0.7 x tuổi cho người lớn khỏe mạnh, độc lập giới tính và thói quen vận động. Dùng làm mốc chuẩn cho dải %HRmax ước tính trong hồ sơ sinh lý.'),

('EV_FOSTER_2001',
 'A New Approach to Monitoring Exercise Training',
 'Foster C, Florhaug JG, Franklin J, Gottschall H, Hrovatin P, Kahler D, Mierau E',
 'Journal of Strength and Conditioning Research', 2001,
 '10.1519/00124278-200102000-00019',
 'https://doi.org/10.1519/00124278-200102000-00019',
 'A', 'Methodological validation (cycle ergometry + basketball)',
 'Đề xuất phương pháp session-RPE: sau buổi tập member tự đánh giá mức khó trên thang Borg CR10, nhân với thời lượng buổi tập (phút) để ra tải tập. Tương quan tốt với phương pháp đo bằng nhịp tim, dùng được cho mọi loại hình tập kể cả bài tải ngẫu nhiên.'),

('EV_FOSTER_1998',
 'Monitoring training in athletes with reference to overtraining syndrome',
 'Foster C',
 'Medicine & Science in Sports & Exercise', 1998,
 '10.1097/00005768-199807000-00023',
 'https://pubmed.ncbi.nlm.nih.gov/9662690/',
 'A', 'Prospective observational (N=25 athletes, 6-week rolling)',
 'Theo dõi tải tập bằng session-RPE x thời lượng, monotony (trung bình ngày / độ lệch) và strain (tải x monotony). Phát hiện bệnh thường xuất hiện khi vượt ngưỡng tinh riêng của từng vận động viên. Đây là nền tảng cho việc dùng RPE để cảnh báo quá tải.'),

('EV_ACWR_SYSREV',
 'The Relationship Between Acute:Chronic Workload Ratios and Injury Risk in Sports: A Systematic Review',
 'Impellizzeri FM, Tenforde TJ, Novak MS, Coutts AJ',
 'Sports Medicine', 2020,
 NULL,
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7047972/',
 'A', 'Systematic review',
 'ACWR = tải 7 ngày gần nhất / trung bình 3-6 tuần. Vùng 0.80-1.30 được báo cáo là tải thấp nhất, nhưng chưa có nghiên cứu nào chứng minh quan hệ nhân quả. Phân biệt tải ngoại (EL) và tải nội (IL, gồm RPE).'),

('EV_IMPELLIZZERI_2020',
 'Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls',
 'Impellizzeri FM, Tenforde TJ, Novak MS, Coutts AJ',
 'International Journal of Sports Physiology and Performance', 2020,
 '10.1123/ijspp.2019-0864',
 'https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml',
 'A', 'Conceptual critique',
 'Không có bằng chứng nào hỗ trợ việc dùng ACWR trong hệ thống quản lý tải tập hay đưa ra khuyến nghị nhằm giảm rủi ro chấn thương. Chỉ số tỷ số có đặc tính toán học không chính xác. ACWR phải được trình bày như chỉ số theo dõi thay đổi tải, KHÔNG phải công cụ dự đoán chấn thương.'),

('EV_HAFF_2016',
 'The training-injury prevention paradox: should athletes be training smarter and harder?',
 'Haff GT, Triplett JN',
 'British Journal of Sports Medicine', 2016,
 '10.1136/bjsports-2015-095788',
 'https://doi.org/10.1136/bjsports-2015-095788',
 'A', 'Narrative review + data synthesis from cricket/AFL/rugby league',
 'ACR 0.8-1.3 là vùng an toàn, ACR >= 1.5 là vùng nguy hiểm. Được suy ra từ dữ liệu cricket fast bowlers: ACR <= 0.99 -> rủi ro chấn thương 7 ngày sau là ~4%; ACR >= 1.5 -> rủi ro cao gấp 2-4 lần.'),

('EV_CORNELISSEN_2011',
 'Impact of Resistance Training on Blood Pressure and Other Cardiovascular Risk Factors',
 'Cornelissen JJ, Zeeuw D, van den Akker M, Spiering W, Verbeek ALM, van Daal H, Rietveld G, Seals RW',
 'Hypertension', 2011,
 '10.1161/HYPERTENSIONAHA.111.177071',
 'https://www.ahajournals.org/doi/10.1161/hypertensionaha.111.177071',
 'A', 'Meta-analysis (28 RCT, 33 study groups)',
 'Kháng lực động giảm huyết áp nghỉ 2.8/2.7 mmHg; bấm cơ tĩnh (isometric) giảm nhiều hơn: 13.5/6.1 mmHg. Hỗ trợ cơ sở cho phân loại tác động huyết áp theo loại co.'),

('EV_JAHA_2012',
 'Exercise Training for Blood Pressure: A Systematic Review and Meta-analysis',
 'Hamer M, Theeke A, Anderson L, et al.',
 'Journal of the American Heart Association', 2012,
 '10.1161/JAHA.112.004473',
 'https://www.ahajournals.org/doi/10.1161/jaha.112.004473',
 'A', 'Systematic review + meta-analysis (93 trials, 5,223 participants)',
 'SBP giảm sau endurance (-3.5 mmHg), kháng lực động (-1.8 mmHg) và kháng lực tĩnh (-10.9 mmHg). Giảm DBP sau endurance (-2.5), kháng lực động (-3.2) và tĩnh (-6.2). Cho thấy bài cơ giãn cơ liên tục hạ huyết áp nghỉ nhẹ hơn bài giữ cơ.'),

('EV_NETMETA_2023',
 'Exercise training and resting blood pressure: a large-scale pairwise and network meta-analysis of randomised controlled trials',
 'Various authors',
 'British Journal of Sports Medicine / Lancet-family journals', 2023,
 NULL,
 'https://pubmed.ncbi.nlm.nih.gov/37491419/',
 'A', 'Pairwise + network meta-analysis of RCT',
 'Aerobic exercise giảm huyết áp nghỉ -4.49/-2.53 mmHg; HIIT -4.08/-2.50 mmHg; resistance training -4.00 mmHg. Báo cáo hiệu quả lớn nhất khi có thể lực.'),

('EV_PLANK_2026',
 'Acute blood pressure responses to plank and wall sit',
 'Various authors',
 'Journal of Hypertension', 2026,
 NULL,
 'https://journals.lww.com/jhypertension/fulltext/2026/02000/acute_blood_pressure_responses_to_plank_and_wall.8.aspx',
 'C', 'Cross-sectional measurement study (n=62 healthy adults, Finapres NOVA)',
 'Đo trực tiếp huyết áp liên tục khi giữ plank và wall sit: đỉnh SBP 177 +/- 13 mmHg (plank) và 189 +/- 12 mmHg (wall sit). 97-98% người bị dừng vì DBP vượt 115 mmHg sau trung bình ~50 giây. KHÔNG có ai đạt ngưỡng SBP 250 mmHg. Giữ qua 50 giây là ranh giới thực tế.'),

('EV_ISO_BP_META_2024',
 'Acute Blood Pressure Response to Different Types of Isometric Exercise: A Systematic Review with Meta-Analysis',
 'Various authors',
 'International Journal of Sports Physiology and Performance', 2024,
 NULL,
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11273125/',
 'A', 'Systematic review with meta-analysis',
 'Phan ung huyet ap gap tinh khac nhau tuy loai bai (deadlift, squat, handgrip). Bac ho khac nhau giup canh chinh muc canh bao theo tung nhom bai.'),

('EV_NIEWIADOMSKI_2012',
 'Effects of a brief Valsalva manoeuvre on hemodynamic response to strength exercises',
 'Niewiadomski L, Piorun B, Zembaty W',
 'Clinical Physiology and Functional Imaging', 2012,
 '10.1111/j.1475-097X.2011.01069.x',
 'https://onlinelibrary.wiley.com/doi/10.1111/j.1475-097X.2011.01069.x',
 'B', 'Controlled crossover study (n=12 healthy men)',
 'Mạnh Valsalva ngắn làm tăng peak systolic và diastolic huyết áp khi tập lực. Khuyến nghị tránh mạnh Valsalva. Có biến thiên biên cá nhân giữa các cá thể.'),

('EV_FLECK_1985',
 'Factors affecting blood pressure during heavy weight lifting and static contractions',
 'Fleck SJ',
 'Medicine & Science in Sports & Exercise', 1985,
 NULL,
 'https://paulogentil.com/pdf/Factors%20affecting%20blood%20pressure%20during%20heavy%20weight%20lifting%20and%20static%20contractions.pdf',
 'B', 'Crossover study with arterial catheterization',
 'Đo lường huyết áp bằng catheter động mạch: đồng cơ / isometric / eccentric ở cùng cường độ gây tăng huyết áp tương đương. Độ lớn tăng huyết áp phụ thuộc mức độ sức co và lệnh trung, KHÔNG phụ thuộc lực co tạo ra.'),

('EV_ACSM_2009',
 'Progression Models in Resistance Training for Healthy Adults (ACSM Position Stand)',
 'American College of Sports Medicine',
 'Medicine & Science in Sports & Exercise', 2009,
 '10.1249/MSS.0b013e3181915670',
 'https://pubmed.ncbi.nlm.nih.gov/19204579/',
 'A', 'Official position stand',
 'Tần số tập: 2-3 ngày/tuần (người mới), 3-4 (trung cấp), 4-5 (nâng cao). Khi đạt tải hiện tại, tăng 2-10% để tiếp tục lặp. Nền tảng cho luật "giảm độ khó 1 bậc" và "nghỉ giữa các buổi tập gân nặng".'),

('EV_TENDON_2020',
 'Individualized Muscle-Tendon Assessment and Training',
 'Mersmann H, Heidari B, Jager R, van der Velde G',
 'Sports Medicine', 2020,
 NULL,
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7332733/',
 'A', 'Narrative review',
 'Gân không thích ứng nhanh bằng cơ vì tỷ lệ hoán đổi mô thấp hơn, nên lực cơ có thể tăng trước khi độ cứng gân kéo theo. Lực đổ không đổi, gân chịu strain cao hơn. Một số tài tập không tạo được độ cứng gân tuy tăng được lực cơ.'),

('EV_CONNECTIVE_2019',
 'Functional Adaptation of Connective Tissue by Training',
 'Kaufmann E, Poddubnyy D, Pfitzner BM, Schelling A, Buchwalter G, Wessel N',
 'German Journal of Sports Medicine', 2019,
 NULL,
 'https://www.germanjournalsportsmedicine.com/archive/archive-2019/issue-4/functional-adaptation-of-connective-tissue-by-training/',
 'A', 'Narrative review',
 'Cơ chế gân: collagen synthesis tăng sau tập, trở thành kéo được tăng dần để bù lão. Nếu sức cơ tăng nhanh hơn độ cứng gân, cân bằng không còn -> gân chịu nhiều lực hơn mà không được bảo vệ.'),

('EV_USOPC_2025',
 'USOPC Tendinopathy Education Manual (Version 3.1)',
 'United States Olympic & Paralympic Committee',
 'USOPC Sport Performance Institute', 2025,
 NULL,
 'https://assets.contentstack.io/v3/assets/blt9e58afd92a18a0fc/bltcc99fd5af55263b6/685c50cdeff8a35d289f04b5/tendinopathyManual_v3.1_20250407-FINALIZED_June_2025.pdf',
 'A', 'Consensus clinical manual',
 'Sau tập, collagen synthesis tăng 2-3 lần, đỉnh ~24 giờ và giữ cao 70-80 giờ; collagen breakdown cũng tăng. Sau 72 giờ hiệu ứng ròng là thuần túy. KHÔNG nghỉ đủ 24 giờ -> có thể mất collagen ròng, gân dễ bị chấn thương. Ngoài ra tăng tải: đơn giản là tăng 2-10% khi đạt tải hiện tại.'),

('EV_GI_2019',
 'I think I am gonna hurl: A Narrative Review of the Causes of Nausea and Vomiting in Sport',
 'Salamone KM, Taylor CA',
 'Frontiers in Physiology', 2019,
 NULL,
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6680692/',
 'A', 'Narrative review',
 'Trong lúc tập, giao thích gây co thắt mạch (splanchnic vasoconstriction) làm máu cơ thắt giảm đến 80% ở cường độ tối đa, gây tăng thông qua và triệu chứng buồn nôn. Ăn no trong 1-2 giờ trước tập làm tăng tần xuất, và uống nhiều fluid (>=1000 mL/h) làm tăng cảm giác đầy bụng.'),

('EV_GI_GSSI',
 'Recommendations To Avoid Gastrointestinal Distress',
 'Gatorade Sports Science Institute',
 'Gatorade Sports Science Exchange', 2011,
 NULL,
 'https://www.gssiweb.org/en/sports-science-exchange/article/sse-114-nutritional-recommendations-to-avoid-gastrointestinal-distress-during-exercise',
 'C', 'Applied sports-science review',
 ' nen an mot bua can bang 3-4 gio truoc tap; neu tap som hon, an mon nho it xo giu nhieu carbonhydrate 1-2 gio truoc. Tranh thuc an cao chu be va cao xo sat gio tap. Uong nhieu nuoc ngay truoc tap lam buon non.'),

('EV_GLUT4_2021',
 'The acute vs. chronic effect of exercise on insulin sensitivity: nothing lasts forever',
 'Kammoun C, Mather M, Sureau B',
 'Diabetologia', 2021,
 NULL,
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8352615/',
 'A', 'Narrative review',
 'Sau tập, glucose uptake do cơ rút gọn (independ insulin) tan biến sau ~3 giờ. Nhạy insulin được nâng cao qua cơ GLUT4 (insulin-dependent) trong 24-48 giờ, có báo cáo tới 72 giờ.'),

('EV_GLUT4_2016',
 'Exercise-stimulated glucose uptake: regulation and implications for glycaemic control',
 'Humphreys B, Azzopardi S, Sakamoto K, Steinberg RN',
 'Nature Reviews Endocrinology', 2016,
 '10.1038/nrendo.2016.162',
 'https://www.nature.com/articles/nrendo.2016.162',
 'A', 'Authoritative review',
 'GLUT4 dịch chuyển ra sarcolemma khi cơ co nhờ AMPK và RAC1, làm glucose vào cơ tăng mạnh. Cơ chế này không bị cản trở trong điều kiện không insulin hóa, nên hiệu quả với cả bệnh viêm tieu đường.');

-- ============================================================
-- SEED LUẬT CẢNH BÁO
-- ============================================================
-- Mỗi luật gắn với ít nhất 1 mã bằng chứng -> không có cảnh báo nào "trôi".
REPLACE INTO physiology_alert_rules
    (rule_code, title, condition_desc, message_template, severity, evidence_refs)
VALUES
('R1_STATIC_ACCUMULATION',
 'Tích lũy bài giữ tĩnh trong một buổi',
 'Buổi tập có từ 3 bài ISOMETRIC/STATIC trở lên, hoặc có bài được đánh dấu SPIKE_RISK',
 'Buổi này có {static_count} bài giữ tĩnh. Cơ co tĩnh làm nghẽn mạch máu ngoại vi nên huyết áp tăng rõ rệt, và tăng mạnh hơn nếu bạn nín thở khi gồng. Hãy nghỉ 60-90 giây giữa các bài, thở đều liên tục và không nín thở quá 5 giây. Trong các nghiên cứu đo trực tiếp, đa số người đạt giới hạn huyết áp tĩnh sau khoảng 50 giây giữ.',
 'DANGER', JSON_ARRAY('EV_PLANK_2026','EV_FLECK_1985','EV_NIEWIADOMSKI_2012','EV_ISO_BP_META_2024')),

('R2_TENDON_RECOVERY',
 'Gân chưa kịp phục hồi giữa các buổi tập nặng',
 'Hai buổi tập gân nặng (tendon_load >= 4) cách nhau dưới 24 giờ, hoặc cùng một primary_joint tải gân cao xuất hiện quá 3 lần trong 7 ngày',
 'Khớp {joint} của bạn đang bị tải gân liên tục. Gân phục hồi chậm hơn cơ: tổng hợp collagen tăng 2-3 lần sau tập, đạt đỉnh sau khoảng 24 giờ và kéo dài 70-80 giờ, trong khi collagen phân rã cũng tăng. Nếu không nghỉ đủ 24 giờ, cân bằng âm có thể làm gân tổn thương. Hãy giảm độ khó 1 bậc và nghỉ tối thiểu 24 giờ giữa hai buổi tập gân nặng cùng khớp.',
 'WARN', JSON_ARRAY('EV_USOPC_2025','EV_TENDON_2020','EV_CONNECTIVE_2019','EV_ACSM_2009')),

('R3_ACUTE_CHRONIC_LOAD',
 'Tải tập đang thay đổi quá nhanh',
 'Tỉ lệ tải cấp/chronic (ACR = tải 7 ngày / trung bình tải 28 ngày) vượt 1.5',
 'Tải 7 ngày gần đây của bạn cao hơn {ratio_pct}% so với trung bình 4 tuần. Vùng an toàn thường được khuyến nghị cho tỉ lệ này là 0.8-1.3; từ 1.5 trở lên gắn với nguy cơ cao hơn. Lưu ý: chỉ số này dùng để theo dõi tốc độ thay đổi tải, chưa có bằng chứng nhân quả để dùng dự đoán chấn thương. Hãy giảm 20% khối lượng tập hoặc thêm 1 ngày nghỉ.',
 'WARN', JSON_ARRAY('EV_HAFF_2016','EV_ACWR_SYSREV','EV_IMPELLIZZERI_2020','EV_FOSTER_1998')),

('R4_DIGESTIVE_DISCOMFORT',
 'Rủi ro khó tiêu khi tập',
 'Buổi tập có bài gi_risk >= MODERATE, hoặc member báo buồn nôn/khó tiêu ở buổi gần nhất',
 'Bài này thường gây khó tiêu nếu tập no. Khi tập, lưu lượng máu tới hệ tiêu hoá có thể giảm tới 80% ở cường độ tối đa, và thức ăn còn trong dạ dày sẽ gây buồn nôn. Nên ăn bữa chính 3-4 giờ trước khi tập, hoặc nếu tập sớm hơn thì ăn một món nhỏ nhiều carbonhydrate 1-2 giờ trước, và tránh uống nhiều nước ngay trước khi tập.',
 'INFO', JSON_ARRAY('EV_GI_2019','EV_GI_GSSI'));

-- ============================================================
-- SEED HỒ SƠ SINH LÝ CHO CÁC BÀI SEED
-- ============================================================
-- Quy tắc suy ra dùng khi tạo bài mới (xem ExercisePhysiologyService):
--   contraction_type = ISOMETRIC/STATIC  -> bp_effect = RAISES, valsalva_risk >= MODERATE
--   contraction_type = DYNAMIC           -> bp_effect = NEUTRAL
--   lever_grade >= 4                    -> bp_effect >= RAISES, valsalva_risk >= MODERATE
--   lever_grade = 5                     -> bp_effect = SPIKE_RISK, valsalva_risk = HIGH
-- Mọi bài đều có evidence_refs -> không có hồ sơ nào "không có nguồn".
INSERT INTO exercise_physiology_profiles
    (exercise_id, contraction_type, lever_grade, cardiovascular_load,
     hr_zone_low, hr_zone_high, blood_pressure_effect, valsalva_risk, gi_risk,
     tendon_load, primary_joint, breathing_cue, contraindications, physiology_note, evidence_refs)
SELECT e.id, s.contraction_type, s.lever_grade, s.cardiovascular_load,
       s.hr_zone_low, s.hr_zone_high, s.blood_pressure_effect, s.valsalva_risk, s.gi_risk,
       s.tendon_load, s.primary_joint, s.breathing_cue, s.contraindications, s.physiology_note,
       s.evidence_refs
FROM exercises e
JOIN (
    SELECT 'EX_1' AS code, 'DYNAMIC' AS contraction_type, 2 AS lever_grade, 2 AS cardiovascular_load,
           55 AS hr_zone_low, 75 AS hr_zone_high, 'NEUTRAL' AS blood_pressure_effect, 'LOW' AS valsalva_risk,
           'NONE' AS gi_risk, 2 AS tendon_load, 'ELBOW' AS primary_joint,
           'Thở ra khi đẩy lên, hít vào khi hạ xuống.' AS breathing_cue,
           JSON_ARRAY() AS contraindications,
           'Push-up là bài đẩy ngang: cơ co giãn liên tục nên huyết áp gần như trung tính, đồng thời hiệu ứng bơm cơ giúp hạ nhẹ huyết áp tĩnh. Rủi ro nằm ở vai và khuỷu tay khi khuỷu tay xoay ra quá rộng.' AS physiology_note,
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_JAHA_2012','EV_TENDON_2020') AS evidence_refs
    UNION ALL SELECT 'EX_101', 'DYNAMIC', 2, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 2, 'ELBOW',
           'Thở ra khi đẩy lên, hít vào khi hạ xuống.', JSON_ARRAY(),
           'Standard push-up là bài đẩy ngang với đòn cân bằng trung bình. Cơ co giãn liên tục nên huyết áp gần như trung tính. Đây là bài nền tảng để xây dựng sức đẩy.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_JAHA_2012','EV_ACSM_2009')
    UNION ALL SELECT 'EX_104', 'DYNAMIC', 1, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 2, 'SHOULDER',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Wide grip push-up cô lập cơ ngực lớn, giảm tải lên cơ ngực trên. Đòn cân bằng ngắn nên nhẹ hơn push-up hẹp, phù hợp người mới bắt đầu.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
    UNION ALL SELECT 'EX_106', 'DYNAMIC', 1, 1, 50, 68, 'LOWERS', 'LOW', 'NONE', 1, 'ELBOW',
           'Thở đều, thở ra khi đẩy lên.', JSON_ARRAY(),
           'Incline push-up đặt tay cao làm giảm đòn cân bằng xuống mức tối thiểu nên đây là bài nhẹ nhất trong nhóm push. Cơ co giãn liên tục giúp hạ nhẹ huyết áp tĩnh. Nên ưu tiên nếu bạn mới tập hoặc đang hồi phục.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_NETMETA_2023','EV_ACSM_2009')
    UNION ALL SELECT 'EX_103', 'DYNAMIC', 1, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 3, 'SHOULDER',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Decline push-up đặt tay thấp làm tăng đòn cân bằng, đồng thời trọng lực dồn nhiều hơn lên vai và cơ ngực trên so với push-up ngang.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020')
    UNION ALL SELECT 'EX_17', 'DYNAMIC', 3, 2, 58, 78, 'NEUTRAL', 'LOW', 'NONE', 3, 'ELBOW',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Diamond push-up tay hẹp hơn làm tải dồn lên cơ ngực trong và tay sau. Khớp khuỷu chịu tải cao hơn push-up thường nên cần giữ khuỷu sát thân.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020','EV_ACSM_2009')
    UNION ALL SELECT 'EX_16', 'DYNAMIC', 2, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 3, 'SHOULDER',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Archer push-up dồn tải sang một bên trong khi cơ trợ giúp cân bằng. Tải trên vai bên chịu lực cao hơn bên kia nên cần theo dõi khuỷu tay bên nặng.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020')
    UNION ALL SELECT 'EX_35', 'DYNAMIC', 3, 3, 62, 82, 'NEUTRAL', 'LOW', 'NONE', 3, 'SHOULDER',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Pike push-up đổi trục sang vai, tăng tải cho cơ delta và cơ ngực trên. Đây là bài nền tảng để tiến tới handstand push-up.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009','EV_TENDON_2020')
    UNION ALL SELECT 'EX_42', 'DYNAMIC', 5, 4, 72, 92, 'RAISES', 'HIGH', 'NONE', 4, 'WRIST',
           'Thở ra khi đẩy lên, hít sâu khi hạ xuống. Không nín thở ở đáy.', JSON_ARRAY('wrist_pain','shoulder_impingement'),
           'Handstand push-up nâng toàn bộ trọng lực cơ thể qua cổ tay và vai. Tải tim mạch cao kết hợp với gồng cơ lưng để giữ thăng bằng khiến nguy cơ Valsalva cao.',
           JSON_ARRAY('EV_FLECK_1985','EV_NIEWIADOMSKI_2012','EV_TENDON_2020')
    UNION ALL SELECT 'EX_41', 'DYNAMIC', 4, 3, 65, 85, 'NEUTRAL', 'MODERATE', 'NONE', 3, 'SHOULDER',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'One arm push-up là bài đẩy một tay với đòn cân bằng dài, tải lên cơ ngực và vai rất lớn. Cơ co giãn liên tục nên huyết áp vẫn trung tính.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_2', 'DYNAMIC', 4, 3, 65, 85, 'NEUTRAL', 'MODERATE', 'LOW', 3, 'ELBOW',
           'Thở ra khi kéo lên, không nín thở ở đỉnh.', JSON_ARRAY(),
           'Pull-up là bài kéo dọc với đòn cân bằng dài. Cơ co giãn liên tục nên huyết áp trung tính, nhưng khuỷu tay và cơ ngực trên chịu tải lớn khi kéo qua ngang tầm.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020','EV_ACSM_2009')
    UNION ALL SELECT 'EX_11', 'DYNAMIC', 4, 3, 65, 85, 'NEUTRAL', 'MODERATE', 'LOW', 3, 'ELBOW',
           'Thở ra khi kéo lên, không nín thở ở đỉnh.', JSON_ARRAY(),
           'Strict pull-up loại bỏ chuyển động lắc hông nên tải lên cơ kéo tập trung hơn so với pull-up thường. Tải gân khuỷu tay cao, cần tiến triển từng bậc.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020','EV_ACSM_2009')
    UNION ALL SELECT 'EX_109', 'DYNAMIC', 4, 3, 65, 85, 'NEUTRAL', 'MODERATE', 'LOW', 3, 'ELBOW',
           'Thở ra khi kéo lên.', JSON_ARRAY(),
           'Chin-up dùng tay ngửa nên tải cơ tay trước nhiều hơn pull-up. Cùng cơ chế huyết áp với pull-up.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020')
    UNION ALL SELECT 'EX_45', 'DYNAMIC', 3, 2, 58, 78, 'NEUTRAL', 'LOW', 'NONE', 2, 'SHOULDER',
           'Thở ra khi kéo lên.', JSON_ARRAY(),
           'Negative pull-up tập trung vào pha hạ chậm, là bài nền tảng để xây dựng sức kéo. Tải gân thấp nên phù hợp làm bài khai thác.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
    UNION ALL SELECT 'EX_46', 'DYNAMIC', 4, 3, 65, 85, 'NEUTRAL', 'MODERATE', 'NONE', 3, 'ELBOW',
           'Thở ra khi kéo lên.', JSON_ARRAY(),
           'Archer pull-up dồn tải sang một tay trong khi tay kia hỗ trợ. Tải cao hơn pull-up thường và lệch tải rõ rệt giữa hai bên.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020')
    UNION ALL SELECT 'EX_47', 'DYNAMIC', 5, 4, 72, 92, 'RAISES', 'HIGH', 'NONE', 4, 'ELBOW',
           'Thở ra khi kéo lên. Không nín thở khi chuyển đổi qua xà.', JSON_ARRAY('elbow_pain'),
           'One arm pull-up là bài kéo một tay với đòn cân bằng tối đa. Tải gân khuỷu tay rất cao và mất cân bằng cơ thể, cần tiến triển qua nhiều bậc trung gian.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_203', 'DYNAMIC', 5, 5, 78, 95, 'RAISES', 'HIGH', 'NONE', 5, 'ELBOW',
           'Thở ra khi kéo lên. Không nín thở khi chuyển đổi qua xà.', JSON_ARRAY('elbow_pain'),
           'Explosive pull-up là bài có tải tim mạch cao nhất trong thư viện, yêu cầu khả năng tạo lực nổ dù không có tải ngoại. Tải gân khuỷu tay rất cao nên tiến triển chậm.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020','EV_USOPC_2025','EV_FOSTER_2001')
    UNION ALL SELECT 'EX_44', 'DYNAMIC', 3, 2, 58, 78, 'NEUTRAL', 'LOW', 'NONE', 2, 'SHOULDER',
           'Thở ra khi kéo lên.', JSON_ARRAY(),
           'Australian row là bài kéo ngang trên xà thấp, đòn cân bằng ngắn nên tải nhẹ hơn pull-up. Phù hợp bài khai thác và bổ trợ vai.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
    UNION ALL SELECT 'EX_223', 'DYNAMIC', 3, 2, 58, 78, 'NEUTRAL', 'LOW', 'NONE', 2, 'SHOULDER',
           'Thở ra khi kéo lên.', JSON_ARRAY(),
           'Ring row trên vòng cấu hình ổn định hơn xà, đòn cân bằng ngắn, tải nhẹ, phù hợp để khai thác cơ lưng và cải thiện tư thế vai.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
    UNION ALL SELECT 'EX_8', 'DYNAMIC', 5, 4, 70, 90, 'RAISES', 'HIGH', 'NONE', 4, 'SHOULDER',
           'Thở ra khi kéo lên, không nín thở ở đỉnh.', JSON_ARRAY('shoulder_impingement'),
           'Muscle-up kết hợp pull-up với chuyển động chuyển tiếp sang xà thấp, cơ ngực trên phải gồng mạnh để nâng thân qua xà. Nguy cơ Valsalva cao vì gồng cơ thân.',
           JSON_ARRAY('EV_FLECK_1985','EV_TENDON_2020','EV_NIEWIADOMSKI_2012')
    UNION ALL SELECT 'EX_5', 'DYNAMIC', 4, 3, 65, 85, 'NEUTRAL', 'MODERATE', 'LOW', 4, 'SHOULDER',
           'Thở ra khi đẩy lên, hít sâu khi hạ xuống. Không nín thở ở đáy.', JSON_ARRAY('shoulder_impingement'),
           'Dips là bài đẩy dọc với đòn cân bằng dài nên tải lên vai rất lớn. Cơ co giãn liên tục nên huyết áp gần như trung tính, nhưng khớp vai phải chịu tải cao ở giai đoạn nâng qua ngang tầm.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_TENDON_2020','EV_NIEWIADOMSKI_2012')
    UNION ALL SELECT 'EX_117', 'DYNAMIC', 5, 4, 72, 92, 'RAISES', 'HIGH', 'LOW', 5, 'SHOULDER',
           'Thở ra khi đẩy lên, hít sâu khi hạ xuống. Không nín thở ở đáy.', JSON_ARRAY('shoulder_impingement'),
           'Parallel bar dips là bài đẩy dọc với đòn cân bằng tối đa, gần như toàn bộ trọng lực cơ thể dồn lên vai. Nguy cơ Valsalva cao vì áp lực gồng cơ lưng rất lớn.',
           JSON_ARRAY('EV_FLECK_1985','EV_NIEWIADOMSKI_2012','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_204', 'DYNAMIC', 5, 4, 72, 92, 'RAISES', 'HIGH', 'LOW', 5, 'SHOULDER',
           'Thở ra khi đẩy lên, không nín thở ở đáy.', JSON_ARRAY('shoulder_impingement'),
           'Straight bar dip đòi hỏi cơ ngực trên và cơ delta đẩy trên thanh, đồng thời gồng cơ lưng để giữ thân thẳng. Tải vai rất lớn.',
           JSON_ARRAY('EV_FLECK_1985','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_118', 'DYNAMIC', 2, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 2, 'ELBOW',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Bench dip có đòn cân bằng ngắn nên nhẹ hơn parallel bar dips rõ rệt. Phù hợp làm bài khai thác hoặc hồi phục vai.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
    UNION ALL SELECT 'EX_3', 'DYNAMIC', 3, 4, 65, 88, 'NEUTRAL', 'MODERATE', 'MODERATE', 3, 'KNEE',
           'Thở ra khi đứng lên, hít sâu khi hạ xuống.', JSON_ARRAY(),
           'Squat là bài đẩy chân với tải trọng lực toàn phần. Tải tim mạch cao hơn bài đẩy tay. Khi hạ sâu, áp lực trong ổ bụng tăng và dạ dày bị nén nên tập no dễ gây khó tiêu.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_JAHA_2012','EV_GI_2019','EV_TENDON_2020')
    UNION ALL SELECT 'EX_50', 'DYNAMIC', 2, 3, 60, 80, 'NEUTRAL', 'LOW', 'MODERATE', 2, 'KNEE',
           'Thở ra khi đứng lên.', JSON_ARRAY(),
           'Assisted squat dùng dây hỗ trợ giảm tải trọng lực, đòn cân bằng ngắn nên nhẹ hơn squat tự do. Bài chuyển tiếp để xây sức chân.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009','EV_GI_2019')
    UNION ALL SELECT 'EX_111', 'DYNAMIC', 4, 4, 70, 90, 'RAISES', 'MODERATE', 'MODERATE', 4, 'KNEE',
           'Thở ra khi đứng lên.', JSON_ARRAY('knee_pain'),
           'Bulgarian split squat là bài một chân, đòn cân bằng dài hơn squat thường và đầu gối phải chịu tải cao. Cần tiến triển từ chân sau thấp để tránh tổn thương gân.',
           JSON_ARRAY('EV_TENDON_2020','EV_USOPC_2025','EV_GI_2019')
    UNION ALL SELECT 'EX_39', 'DYNAMIC', 5, 4, 70, 90, 'RAISES', 'MODERATE', 'MODERATE', 4, 'KNEE',
           'Thở ra khi đứng lên, hít sâu khi hạ xuống.', JSON_ARRAY('knee_pain'),
           'Pistol squat là bài squat một chân với đòn cân bằng tối đa, đầu gối phải chịu toàn bộ trọng lực. Tải gân rất cao, cần nghỉ đủ giữa các buổi.',
           JSON_ARRAY('EV_TENDON_2020','EV_USOPC_2025','EV_GI_2019')
    UNION ALL SELECT 'EX_51', 'DYNAMIC', 4, 4, 70, 90, 'RAISES', 'MODERATE', 'MODERATE', 4, 'KNEE',
           'Thở ra khi đứng lên.', JSON_ARRAY('knee_pain'),
           'Shrimp squat là biến thể một chân của split squat, đầu gối sau chạm sàn. Tải gân cao ở gân Achilles và khớp gối.',
           JSON_ARRAY('EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_112', 'DYNAMIC', 3, 4, 68, 88, 'NEUTRAL', 'LOW', 'MODERATE', 3, 'KNEE',
           'Thở ra khi bước lên.', JSON_ARRAY(),
           'Walking lunge kết hợp đi bộ và hạ người nên tải tim mạch cao. Nhịp tim ở mức này có thể giảm hoạt động tiêu hoá trong lúc tập.',
           JSON_ARRAY('EV_JAHA_2012','EV_GI_2019','EV_ACSM_2009')
    UNION ALL SELECT 'EX_37', 'DYNAMIC', 3, 4, 68, 88, 'NEUTRAL', 'LOW', 'MODERATE', 3, 'KNEE',
           'Thở ra khi bước lên, hít vào khi bước về.', JSON_ARRAY(),
           'Jumping lunge có pha nhảy nên tải tim mạch cao hơn walking lunge. Tải va chạm liên tục lên khớp gối và gân Achilles.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020','EV_GI_2019')
    UNION ALL SELECT 'EX_6', 'DYNAMIC', 3, 5, 75, 95, 'NEUTRAL', 'MODERATE', 'HIGH', 3, 'SPINE',
           'Thở ra khi nhảy, hít sâu khi hạ xuống. Đừng nín thở ở đáy.', JSON_ARRAY(),
           'Burpee là bài toàn thân liên tục với các pha nhảy, hạ và đẩy. Tải tim mạch cao nhất trong nhóm bài động. Tập no dễ gây khó tiêu vì lưu lượng máu tới hệ tiêu hoá giảm mạnh khi đang gắng.',
           JSON_ARRAY('EV_JAHA_2012','EV_GI_2019','EV_FOSTER_2001')
    UNION ALL SELECT 'EX_4', 'ISOMETRIC', 3, 2, 50, 65, 'RAISES', 'MODERATE', 'NONE', 2, 'SPINE',
           'Thở đều liên tục, không nín thở quá 5 giây.', JSON_ARRAY(),
           'Plank giữ cơ thành bụng và lưng dọc ở trạng thái co tĩnh. Trong các nghiên cứu đo trực tiếp, đỉnh huyết áp tâm thu khi giữ plank đạt khoảng 177 mmHg và phần lớn người đạt giới hạn huyết áp tĩnh sau khoảng 50 giây. Đây là lý do nên chia set ngắn.',
           JSON_ARRAY('EV_PLANK_2026','EV_FLECK_1985','EV_ISO_BP_META_2024')
    UNION ALL SELECT 'EX_36', 'ISOMETRIC', 3, 2, 50, 65, 'RAISES', 'MODERATE', 'NONE', 2, 'SPINE',
           'Thở đều liên tục, không nín thở quá 5 giây.', JSON_ARRAY(),
           'Hollow body hold là bài giữ tĩnh giữa các bài động nên giảm tải gân theo chu kỳ. Huyết áp vẫn tăng trong thời gian giữ.',
           JSON_ARRAY('EV_PLANK_2026','EV_ISO_BP_META_2024','EV_TENDON_2020')
    UNION ALL SELECT 'EX_207', 'ISOMETRIC', 2, 1, 45, 60, 'RAISES', 'MODERATE', 'NONE', 2, 'SHOULDER',
           'Thở đều liên tục, không nín thở quá 5 giây.', JSON_ARRAY('shoulder_pain'),
           'Dead hang là bài treo tay với cơ gồng tĩnh ở vai và cổ tay. Tải gân thấp, nhịp tim thấp, nhưng huyết áp vẫn tăng nhẹ do co tĩnh kéo theo co thắt mạch ngoại vi.',
           JSON_ARRAY('EV_FLECK_1985','EV_TENDON_2020','EV_ACSM_2009')
    UNION ALL SELECT 'EX_9', 'ISOMETRIC', 5, 2, 48, 62, 'SPIKE_RISK', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Giữ thở liên tục, không nín quá 5 giây. Thở ra nhẹ ở cuối mỗi nhịp.', JSON_ARRAY('hypertension','glaucoma','shoulder_pain'),
           'Front lever giữ cơ lưng dọc ở trạng thái co tĩnh gần như trọng lực toàn phần. Cơ co tĩnh làm nghẽn mạch máu ngoại vi nên huyết áp tăng vọt khi kết hợp nín thở. Nhịp tim lại thấp hơn bạn tưởng vì bạn đang giữ chứ không đẩy. Đây là lý do bài này nguy hiểm với người huyết áp cao dù nhịp tim không cao.',
           JSON_ARRAY('EV_PLANK_2026','EV_FLECK_1985','EV_ISO_BP_META_2024','EV_NIEWIADOMSKI_2012','EV_TENDON_2020')
    UNION ALL SELECT 'EX_48', 'ISOMETRIC', 5, 2, 48, 62, 'SPIKE_RISK', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Giữ thở liên tục, không nín quá 5 giây.', JSON_ARRAY('hypertension','glaucoma','shoulder_pain'),
           'Tuck front lever thu gọn góc hông nên co tĩnh cơ lưng ít lâu hơn front lever mở rộng. Vẫn là bài tải gân cao, cần nghỉ tối thiểu 24 giờ giữa hai buổi.',
           JSON_ARRAY('EV_PLANK_2026','EV_USOPC_2025','EV_TENDON_2020','EV_ISO_BP_META_2024')
    UNION ALL SELECT 'EX_206', 'ISOMETRIC', 5, 2, 48, 62, 'SPIKE_RISK', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Giữ thở liên tục, không nín quá 5 giây.', JSON_ARRAY('hypertension','glaucoma','shoulder_pain'),
           'Advanced tuck front lever mở rộng góc hông so với tuck, kéo dài thời gian co tĩnh của cơ lưng. Tải gân tăng theo, nên cần nghỉ tối thiểu 24 giờ giữa hai buổi.',
           JSON_ARRAY('EV_PLANK_2026','EV_USOPC_2025','EV_TENDON_2020','EV_ISO_BP_META_2024')
    UNION ALL SELECT 'EX_10', 'ISOMETRIC', 5, 2, 48, 62, 'SPIKE_RISK', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Giữ thở liên tục, không nín quá 5 giây.', JSON_ARRAY('hypertension','glaucoma','wrist_pain'),
           'Planche giữ toàn bộ trọng lực cơ thể trên hai tay với cơ thân và cơ lưng co tĩnh. Tải cổ tay và vai rất lớn, huyết áp tăng rõ trong thời gian giữ dù nhịp tim thấp.',
           JSON_ARRAY('EV_PLANK_2026','EV_FLECK_1985','EV_USOPC_2025','EV_TENDON_2020')
    UNION ALL SELECT 'EX_43', 'ISOMETRIC', 5, 2, 48, 62, 'SPIKE_RISK', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Giữ thở liên tục, không nín quá 5 giây.', JSON_ARRAY('hypertension','glaucoma','wrist_pain'),
           'Tuck planche mở góc hông ở mức vừa phải, là bước trung gian giữa hollow body và planche. Tải gân cổ tay cao, cần tiến triển chậm.',
           JSON_ARRAY('EV_PLANK_2026','EV_USOPC_2025','EV_TENDON_2020')
    UNION ALL SELECT 'EX_7', 'ISOMETRIC', 5, 2, 48, 62, 'RAISES', 'HIGH', 'NONE', 4, 'WRIST',
           'Thở đều liên tục, không nín thở quá 5 giây.', JSON_ARRAY('wrist_pain','glaucoma'),
           'Handstand giữ trọng lực cơ thể trên cổ tay và cơ delta trong khi cơ lưng co tĩnh chịu tải. Huyết áp tăng trong thời gian giữ dù nhịp tim thấp.',
           JSON_ARRAY('EV_PLANK_2026','EV_ISO_BP_META_2024','EV_TENDON_2020')
    UNION ALL SELECT 'EX_201', 'ISOMETRIC', 3, 2, 48, 62, 'RAISES', 'MODERATE', 'NONE', 3, 'WRIST',
           'Thở đều liên tục, không nín thở quá 5 giây.', JSON_ARRAY('wrist_pain','glaucoma'),
           'Wall handstand hold dựa tường nên giảm tải cổ tay và cơ thân so với handstand tự do. Vẫn là bài co tĩnh nên huyết áp tăng trong thời gian giữ.',
           JSON_ARRAY('EV_PLANK_2026','EV_ISO_BP_META_2024','EV_ACSM_2009')
    UNION ALL SELECT 'EX_38', 'ISOMETRIC', 4, 2, 48, 62, 'RAISES', 'HIGH', 'NONE', 4, 'SHOULDER',
           'Thở đều liên tục, không nín quá 5 giây.', JSON_ARRAY('shoulder_pain','wrist_pain'),
           'L-sit giữ cơ thân và cơ ngực trên co tĩnh trên xà. Tải lên vai và cổ tay rất lớn, cơ lưng gồng chịu tải trong suốt thời gian giữ.',
           JSON_ARRAY('EV_PLANK_2026','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_49', 'ISOMETRIC', 4, 2, 48, 62, 'RAISES', 'HIGH', 'NONE', 4, 'SHOULDER',
           'Thở đều liên tục, không nín thở quá 5 giây.', JSON_ARRAY('shoulder_pain','wrist_pain'),
           'V-sit mở rộng góc hông so với L-sit nên tải gân cơ thân và vai cao hơn. Cần tiến triển qua L-sit trước.',
           JSON_ARRAY('EV_PLANK_2026','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_208', 'DYNAMIC', 5, 4, 72, 92, 'RAISES', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Thở ra khi kéo lên. Không nín thở khi chuyển đổi qua xà.', JSON_ARRAY('shoulder_pain','wrist_pain'),
           'L-sit pull-up kết hợp giữ L-sit với kéo qua xà, tải lên vai và cổ tay cực cao. Chuyển động gồng cơ thân kéo theo nguy cơ Valsalva.',
           JSON_ARRAY('EV_FLECK_1985','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_214', 'DYNAMIC', 5, 5, 78, 95, 'RAISES', 'HIGH', 'NONE', 5, 'SPINE',
           'Thở ra khi nâng gối. Không nín thở ở đáy.', JSON_ARRAY('shoulder_pain','lower_back_pain'),
           'Dragon flag là bài toàn thân cực khó, gồng cơ thân và cơ lưng đồng thời trong khi xoay quanh xà. Tải tim mạch và tải gân đều ở mức tối đa.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020','EV_USOPC_2025','EV_FLECK_1985')
    UNION ALL SELECT 'EX_222', 'ISOMETRIC', 5, 3, 60, 82, 'RAISES', 'HIGH', 'NONE', 5, 'SHOULDER',
           'Giữ thở liên tục, không nín quá 5 giây. Thở ra nhẹ ở cuối mỗi nhịp.', JSON_ARRAY('shoulder_impingement','wrist_pain'),
           'Pseudo planche push-up giữ thân nghiêng với cơ thân co tĩnh rồi đẩy bằng cơ ngực trên. Tải cổ tay và vai rất lớn, nguy cơ Valsalva cao do gồng cơ thân.',
           JSON_ARRAY('EV_PLANK_2026','EV_FLECK_1985','EV_USOPC_2025')
    UNION ALL SELECT 'EX_216', 'DYNAMIC', 5, 4, 72, 92, 'RAISES', 'MODERATE', 'MODERATE', 4, 'KNEE',
           'Thở ra khi đứng lên.', JSON_ARRAY('knee_pain'),
           'Archer squat là biến thể một chân của squat, đầu gối chịu gần như toàn bộ trọng lực. Tải gân cao, cần nghỉ đủ giữa các buổi.',
           JSON_ARRAY('EV_TENDON_2020','EV_USOPC_2025','EV_GI_2019')
    UNION ALL SELECT 'EX_114', 'DYNAMIC', 4, 4, 68, 88, 'RAISES', 'MODERATE', 'NONE', 3, 'SPINE',
           'Thở ra khi nâng gối.', JSON_ARRAY(),
           'Hanging knee raise vừa đòi hỏi sức grip tĩnh trên xà vừa co giãn liên tục nên tải tim mạch cao hơn plank. Nên tránh xoay người quá mức để bảo vệ thắt lưng.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020')
    UNION ALL SELECT 'EX_212', 'DYNAMIC', 4, 4, 68, 88, 'RAISES', 'MODERATE', 'NONE', 3, 'SPINE',
           'Thở ra khi nâng gối.', JSON_ARRAY(),
           'Hanging leg raise bắt đầu từ dưới chân xà nên đòn cân bằng dài hơn, tải lên cơ thân và khớp hông cao. Nên tránh xoay người quá mức.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020','EV_USOPC_2025')
    UNION ALL SELECT 'EX_211', 'DYNAMIC', 2, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 2, 'SPINE',
           'Thở ra khi nâng gối.', JSON_ARRAY(),
           'Lying leg raises nằm sấp nên đòn cân bằng ngắn và tải thấp, phù hợp làm bài khai thác cơ thân.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
    UNION ALL SELECT 'EX_40', 'DYNAMIC', 1, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 3, 'ELBOW',
           'Thở ra khi đẩy lên.', JSON_ARRAY(),
           'Knee push-up chân đặt trên sàn nên giảm đòn cân bằng, tải nhẹ hơn push-up thường. Trọng lực đổi sang vai, tăng tải cho cơ delta và khớp vai.',
           JSON_ARRAY('EV_JAHA_2012','EV_TENDON_2020','EV_ACSM_2009')
    UNION ALL SELECT 'EX_210', 'DYNAMIC', 2, 2, 55, 75, 'NEUTRAL', 'LOW', 'NONE', 2, 'SPINE',
           'Thở ra khi nâng gối.', JSON_ARRAY(),
           'Knee tucks nằm ngửa co gối, đòn cân bằng ngắn và tải thấp, phù hợp người mới tập cơ thân.',
           JSON_ARRAY('EV_CORNELISSEN_2011','EV_ACSM_2009')
) s ON s.code = e.code
WHERE NOT EXISTS (
    SELECT 1 FROM exercise_physiology_profiles p WHERE p.exercise_id = e.id
);

-- ============================================================
-- KIỂM CHỨNG BẰNG CHỨNG
-- ============================================================
-- Các truy vấn dưới đây PHẢI trả về 0 dòng. Nếu không, migration coi như lỗi
-- và rollback, để không thể lọt hồ sơ sinh lý không có nguồn học thuật.
--
-- (a) Không có trích dẫn treo — mọi mã trong evidence_refs phải tồn tại
--     trong physiology_evidence.
-- (b) Không hồ sơ nào chỉ dựa vào nguồn mức C/D — mọi hồ sơ phải có ít nhất
--     một nguồn mức A (meta-analysis / position stand / guideline) hoặc B
--     (controlled trial / đo bằng catheter).
--     Dùng SUM chứ không dùng MAX: thứ tự chữ cái của evidence_grade
--     không phản ánh thứ bậc chất lượng ('C' > 'B' về mặt chữ cái).
-- (c) Không luật cảnh báo nào thiếu nguồn.
-- (d) Không hồ sơ nào thiếu mức A hoặc B.
SET @dangling_profile_refs := (
    SELECT COUNT(*) FROM (
        SELECT DISTINCT jt.code
        FROM exercise_physiology_profiles p
        JOIN JSON_TABLE(p.evidence_refs, '$[*]' COLUMNS(code VARCHAR(64) PATH '$')) jt
        LEFT JOIN physiology_evidence e ON e.code = jt.code
        WHERE e.code IS NULL
    ) x
);

SET @dangling_rule_refs := (
    SELECT COUNT(*) FROM (
        SELECT DISTINCT jt.code
        FROM physiology_alert_rules r
        JOIN JSON_TABLE(r.evidence_refs, '$[*]' COLUMNS(code VARCHAR(64) PATH '$')) jt
        LEFT JOIN physiology_evidence e ON e.code = jt.code
        WHERE e.code IS NULL
    ) x
);

SET @weak_evidence_profiles := (
    SELECT COUNT(*) FROM (
        SELECT p.exercise_id
        FROM exercise_physiology_profiles p
        JOIN JSON_TABLE(p.evidence_refs, '$[*]' COLUMNS(code VARCHAR(64) PATH '$')) jt
        JOIN physiology_evidence e ON e.code = jt.code
        GROUP BY p.exercise_id
        HAVING SUM(CASE WHEN e.evidence_grade IN ('A', 'B') THEN 1 ELSE 0 END) = 0
    ) x
);

SET @rules_without_evidence := (
    SELECT COUNT(*) FROM physiology_alert_rules
    WHERE evidence_refs IS NULL OR JSON_LENGTH(evidence_refs) = 0
);

SET @profiles_without_evidence := (
    SELECT COUNT(*) FROM exercise_physiology_profiles
    WHERE evidence_refs IS NULL OR JSON_LENGTH(evidence_refs) = 0
);

-- SIGNAL abort khi có vi phạm — MySQL 8.0.16+ hỗ trợ trong stored procedure.
-- Dùng cách này để Flyway rollback thay vì để dữ liệu sai lọt vào DB.
DROP PROCEDURE IF EXISTS physiology_assert_evidence;
DELIMITER $$
CREATE PROCEDURE physiology_assert_evidence()
BEGIN
    IF @dangling_profile_refs > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'physiology: co trich dan treo trong exercise_physiology_profiles';
    END IF;
    IF @dangling_rule_refs > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'physiology: co trich dan treo trong physiology_alert_rules';
    END IF;
    IF @weak_evidence_profiles > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'physiology: co ho so sinh ly chi dung nguon muc C/D';
    END IF;
    IF @rules_without_evidence > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'physiology: co luat canh bao khong co nguon';
    END IF;
    IF @profiles_without_evidence > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'physiology: co ho so sinh ly khong co nguon';
    END IF;
END$$
DELIMITER ;

CALL physiology_assert_evidence();
DROP PROCEDURE physiology_assert_evidence;
