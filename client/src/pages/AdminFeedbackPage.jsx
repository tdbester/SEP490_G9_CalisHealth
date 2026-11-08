import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import { useTranslation } from "react-i18next";
import { adminUsersApi, apiErrorMessage } from "../api/adminUsers";
import { DarkPill } from "../components/ContentShared";
import { CM } from "../theme-content";

/** Trạng thái một đơn góp ý. */
const STATUS = {
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
};

/** Nhãn + màu của từng trạng thái. */
const STATUS_META = {
  [STATUS.ESCALATED]: { labelKey: "admin.feedback.statusEscalated", tone: "pink" },
  [STATUS.RESOLVED]: { labelKey: "admin.feedback.statusResolved", tone: "success" },
  [STATUS.REJECTED]: { labelKey: "admin.feedback.statusRejected", tone: "danger" },
};

/** Nhãn của từng nhóm nội dung. */
const CATEGORY_LABEL = {
  GENERAL: "admin.feedback.categoryGeneral",
  EXERCISE_CONTENT: "admin.feedback.categoryExercise",
  WORKOUT_CONTENT: "admin.feedback.categoryWorkout",
  TECHNICAL: "admin.feedback.categoryTechnical",
  OTHER: "admin.feedback.categoryOther",
};

/** Các bộ lọc trạng thái trên thanh công cụ. */
const FILTERS = [
  { key: "ALL", labelKey: "admin.feedback.filterAll" },
  { key: STATUS.ESCALATED, labelKey: "admin.feedback.statusEscalated" },
  { key: STATUS.RESOLVED, labelKey: "admin.feedback.statusResolved" },
  { key: STATUS.REJECTED, labelKey: "admin.feedback.statusRejected" },
];

/** Các nhóm nội dung có thể lọc. */
const CATEGORIES = [
  { key: "ALL", labelKey: "admin.feedback.filterAllCategories" },
  { key: "GENERAL", labelKey: "admin.feedback.categoryGeneral" },
  { key: "EXERCISE_CONTENT", labelKey: "admin.feedback.categoryExercise" },
  { key: "WORKOUT_CONTENT", labelKey: "admin.feedback.categoryWorkout" },
  { key: "TECHNICAL", labelKey: "admin.feedback.categoryTechnical" },
  { key: "OTHER", labelKey: "admin.feedback.categoryOther" },
];

/**
 * Style dùng chung cho header và ô dữ liệu của bảng.
 *
 * Theme (`theme-content.js`) mặc định canh giữa mọi ô và ép mọi `Stack` bên
 * trong ô về `justifyContent: center` — với bảng nhiều cột sẽ khiến tiêu đề
 * cột lệch khỏi nội dung. Ở đây ta ghi đè lại: mọi cột đều canh trái, chiều
 * rộng cố định theo `colgroup` nên tiêu đề luôn nằm đúng trên dữ liệu.
 */
const HEAD_CELL_SX = {
  textAlign: "left",
  verticalAlign: "middle",
  bgcolor: CM.surfaceSoft,
  color: CM.textDim,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  px: 2,
  py: 1.25,
  borderBottom: `1px solid ${CM.border}`,
};

const BODY_CELL_SX = {
  textAlign: "left",
  verticalAlign: "middle",
  px: 2,
  py: 1.5,
  borderBottom: `1px solid ${CM.border}`,
  // Ghi đè rule của theme để nội dung ô bám sát mép trái.
  "& > .MuiStack-root": { justifyContent: "flex-start", alignItems: "flex-start" },
};

/** Chiều rộng cột — dùng chung cho `colgroup` để header và body khớp tuyệt đối. */
const COL_SIZES = [
  { key: "feedback", width: "32%" },
  { key: "member", width: "20%" },
  { key: "category", width: "14%" },
  { key: "status", width: "15%" },
  { key: "submitted", width: "12%" },
  { key: "action", width: "7%" },
];

const dateFilterSx = {
  "& .MuiInputLabel-root": { color: CM.textMuted },
  "& .MuiInputLabel-root.Mui-focused": { color: CM.violetBright },
  "& .MuiOutlinedInput-root": {
    color: CM.text,
    bgcolor: CM.surfaceSoft,
    "& fieldset": { borderColor: CM.border },
    "&:hover fieldset": { borderColor: CM.borderStrong },
    "&.Mui-focused fieldset": { borderColor: CM.violet, borderWidth: 1 },
  },
  "& input": { colorScheme: "dark", minHeight: 22 },
  "& input::-webkit-calendar-picker-indicator": {
    filter: "invert(0.9)",
    cursor: "pointer",
  },
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Màn "Góp ý & Khiếu nại" của Admin.
 *
 * Bảng chỉ liệt kê đơn; mọi thao tác quyết định cuối cùng nằm ở màn chi tiết
 * (/admin/feedback/:id).
 */
export default function AdminFeedbackPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Ô tìm kiếm chỉ gửi đi sau khi người dùng ngừng gõ 400ms.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminUsersApi.feedback({
        status: filter === "ALL" ? undefined : filter,
        category: category === "ALL" ? undefined : category,
        search: search || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setData(res);
    } catch (err) {
      setError(apiErrorMessage(err, t("admin.feedback.loadFailed")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, category, search, fromDate, toDate]);

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

  const hasFilters =
    filter !== "ALL" ||
    category !== "ALL" ||
    Boolean(search) ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const clearFilters = () => {
    setFilter("ALL");
    setCategory("ALL");
    setSearch("");
    setSearchInput("");
    setFromDate("");
    setToDate("");
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>{t("admin.feedback.breadcrumb")}</Typography>

      <Box
        sx={{
          mt: 1,
          mb: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ maxWidth: 680 }}>
          <Typography component="h1" sx={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>
            {t("admin.feedback.pageTitle")}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted }}>
            {t("admin.feedback.description")}
          </Typography>
        </Box>
        <Tooltip title={t("common.ui.refreshAria")}>
          <span>
            <Button
              onClick={() => void load()}
              disabled={loading}
              variant="outlined"
              aria-label={t("common.ui.refreshAria")}
              sx={{ minWidth: 40, width: 40, px: 0 }}
            >
              {loading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 180,
            p: 2.25,
            borderRadius: "16px",
            bgcolor: CM.surface,
            border: `1px solid ${CM.border}`,
          }}
        >
          <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
            {t("admin.feedback.escalated")}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 28, fontWeight: 700, color: CM.pink }}>
            {(data?.escalated ?? 0).toLocaleString("en-US")}
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 180,
            p: 2.25,
            borderRadius: "16px",
            bgcolor: CM.surface,
            border: `1px solid ${CM.border}`,
          }}
        >
          <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
            {t("admin.feedback.resolved")}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 28, fontWeight: 700, color: CM.green }}>
            {(data?.resolved ?? 0).toLocaleString("en-US")}
          </Typography>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <Card sx={{ overflow: "hidden" }}>
        {/* ── Thanh bộ lọc ─────────────────────────────────────── */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ p: 1.5, borderBottom: `1px solid ${CM.border}` }}
        >
          <TextField
            select
            size="small"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            SelectProps={{ SelectDisplayProps: { "aria-label": t("admin.feedback.filterByStatus") } }}
            sx={{ minWidth: 180 }}
          >
            {FILTERS.map((item) => (
              <MenuItem key={item.key} value={item.key}>
                {t(item.labelKey)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            SelectProps={{ SelectDisplayProps: { "aria-label": t("admin.feedback.filterByCategory") } }}
            sx={{ minWidth: 180 }}
          >
            {CATEGORIES.map((item) => (
              <MenuItem key={item.key} value={item.key}>
                {t(item.labelKey)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t("admin.feedback.searchPlaceholder")}
            inputProps={{ "aria-label": t("admin.feedback.searchAria") }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" color="disabled" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 220 }}
          />

          <TextField
            size="small"
            type="date"
            label={t("admin.feedback.fromDate")}
            value={fromDate}
            onChange={(event) => {
              const next = event.target.value;
              setFromDate(next);
              if (toDate && next && toDate < next) setToDate(next);
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              max: toDate || undefined,
              "aria-label": t("admin.feedback.fromDateAria"),
            }}
            sx={{ ...dateFilterSx, minWidth: { xs: "100%", md: 155 } }}
          />

          <TextField
            size="small"
            type="date"
            label={t("admin.feedback.toDate")}
            value={toDate}
            onChange={(event) => {
              const next = event.target.value;
              setToDate(next);
              if (fromDate && next && next < fromDate) setFromDate(next);
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: fromDate || undefined,
              "aria-label": t("admin.feedback.toDateAria"),
            }}
            sx={{ ...dateFilterSx, minWidth: { xs: "100%", md: 155 } }}
          />

          {hasFilters ? (
            <Button
              size="small"
              variant="text"
              startIcon={<ClearRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={clearFilters}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            >
              {t("admin.feedback.clearFilters")}
            </Button>
          ) : null}
        </Stack>

        <TableContainer>
          <Table
            aria-label={t("admin.feedback.tableAria")}
            sx={{
              minWidth: 900,
              tableLayout: "fixed",
              "& .MuiTableCell-root": { borderBottom: `1px solid ${CM.border}` },
            }}
          >
            <colgroup>
              {COL_SIZES.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t("admin.feedback.colFeedback")}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t("admin.feedback.colMember")}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t("admin.feedback.colCategory")}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t("admin.feedback.colStatus")}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t("admin.feedback.colSubmitted")}</TableCell>
                <TableCell sx={{ ...HEAD_CELL_SX, textAlign: "right" }}>
                  {t("admin.feedback.colAction")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6} sx={BODY_CELL_SX}>
                      <Box sx={{ height: 36, opacity: 0.4 }} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                items.map((row) => {
                  const meta = STATUS_META[row.status] ?? STATUS_META[STATUS.ESCALATED];
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell sx={BODY_CELL_SX}>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <Box
                            aria-hidden
                            sx={{
                              width: 34,
                              height: 34,
                              flexShrink: 0,
                              display: "grid",
                              placeItems: "center",
                              borderRadius: "10px",
                              bgcolor: "rgba(139,92,246,0.16)",
                              color: CM.violetBright,
                            }}
                          >
                            <ChatBubbleOutlineRoundedIcon fontSize="small" />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              sx={{
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: "#fff",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.title}
                            </Typography>
                            <Typography
                              sx={{
                                mt: 0.25,
                                fontSize: 12,
                                color: CM.textMuted,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.content}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={BODY_CELL_SX}>
                        <Typography
                          sx={{
                            fontSize: 13,
                            color: CM.text,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.memberName || t("admin.feedback.unknown")}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 11.5,
                            color: CM.textDim,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.memberEmail}
                        </Typography>
                      </TableCell>
                      <TableCell sx={BODY_CELL_SX}>
                        <DarkPill tone="neutral">
                          {t(CATEGORY_LABEL[row.category] || CATEGORY_LABEL.OTHER)}
                        </DarkPill>
                      </TableCell>
                      <TableCell sx={BODY_CELL_SX}>
                        <DarkPill tone={meta.tone}>{t(meta.labelKey)}</DarkPill>
                      </TableCell>
                      <TableCell sx={BODY_CELL_SX}>
                        <Typography
                          sx={{
                            fontSize: 12,
                            color: CM.textMuted,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDateTime(row.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...BODY_CELL_SX, textAlign: "right" }}>
                        <Button
                          component={RouterLink}
                          to={`/admin/feedback/${encodeURIComponent(row.id)}`}
                          size="small"
                          variant="outlined"
                          sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0 }}
                        >
                          {t("admin.feedback.view")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {!loading && !error && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: CM.textMuted }}>
                    {hasFilters
                      ? t("admin.feedback.noMatch")
                      : t("admin.feedback.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
