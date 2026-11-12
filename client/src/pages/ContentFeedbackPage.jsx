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
import { contentManagerApi } from "../api/contentManager";
import { useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, SummaryCard } from "../components/ContentShared";
import { EmptyState, HEAD_ROW_SX } from "../components/ContentDataCard";
import { CM } from "../theme-content";

/** Trạng thái một đơn góp ý. */
const STATUS = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
};

/** Nhãn + màu của từng trạng thái. */
const STATUS_META = {
  [STATUS.PENDING]: { labelKey: "contentManager.feedback.statusPending", tone: "warning" },
  [STATUS.IN_REVIEW]: { labelKey: "contentManager.feedback.statusInReview", tone: "sky" },
  [STATUS.ESCALATED]: { labelKey: "contentManager.feedback.statusEscalated", tone: "pink" },
  [STATUS.RESOLVED]: { labelKey: "contentManager.feedback.statusResolved", tone: "success" },
  [STATUS.REJECTED]: { labelKey: "contentManager.feedback.statusRejected", tone: "danger" },
};

/** Nhãn của từng nhóm nội dung. */
const CATEGORY_LABEL = {
  GENERAL: "contentManager.feedback.categoryGeneral",
  EXERCISE_CONTENT: "contentManager.feedback.categoryExercise",
  WORKOUT_CONTENT: "contentManager.feedback.categoryWorkout",
  TECHNICAL: "contentManager.feedback.categoryTechnical",
  OTHER: "contentManager.feedback.categoryOther",
};

/**
 * Chiều rộng cột — dùng chung cho `colgroup` để header và body khớp tuyệt đối.
 *
 * Cột "Feedback" là nội dung chữ nên căn trái; các cột còn lại là dữ liệu ngắn
 * (member / category / status / thời gian) nên căn giữa để nhìn thành hàng lề
 * đều. Cột action để đủ chỗ cho nút "View" không bị bó.
 */
const CONTENT_COL_SIZES = [
  { key: "feedback", width: "36%" },
  { key: "member", width: "17%" },
  { key: "category", width: "13%" },
  { key: "status", width: "13%" },
  { key: "processed", width: "13%" },
  { key: "action", width: "8%" },
];

/** Các bộ lọc trạng thái trên thanh công cụ. */
const FILTERS = [
  { key: "ALL", labelKey: "contentManager.feedback.filterAll" },
  { key: STATUS.PENDING, labelKey: "contentManager.feedback.statusPending" },
  { key: STATUS.IN_REVIEW, labelKey: "contentManager.feedback.statusInReview" },
  { key: STATUS.ESCALATED, labelKey: "contentManager.feedback.statusEscalated" },
  { key: STATUS.RESOLVED, labelKey: "contentManager.feedback.statusResolved" },
  { key: STATUS.REJECTED, labelKey: "contentManager.feedback.statusRejected" },
];

/** Các nhóm nội dung có thể lọc. */
const CATEGORIES = [
  { key: "ALL", labelKey: "contentManager.feedback.filterAllCategories" },
  { key: "GENERAL", labelKey: "contentManager.feedback.categoryGeneral" },
  { key: "EXERCISE_CONTENT", labelKey: "contentManager.feedback.categoryExercise" },
  { key: "WORKOUT_CONTENT", labelKey: "contentManager.feedback.categoryWorkout" },
  { key: "TECHNICAL", labelKey: "contentManager.feedback.categoryTechnical" },
  { key: "OTHER", labelKey: "contentManager.feedback.categoryOther" },
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
 * Màn "Góp ý & Khiếu nại" của Content Manager.
 *
 * Bảng chỉ liệt kê đơn; mọi thao tác xử lý nằm ở màn chi tiết
 * ({@link /content/feedback/:id}).
 */
export default function ContentFeedbackPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Ô tìm kiếm chỉ gửi đi sau khi người dùng bấm Enter / bấm nút tìm.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useApiQuery(
    () =>
      contentManagerApi.feedback({
        status: filter === "ALL" ? undefined : filter,
        category: category === "ALL" ? undefined : category,
        search: search || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    { deps: [filter, category, search, fromDate, toDate] }
  );

  const data = query.data;
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
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={[
          { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
          { labelKey: "contentManager.feedback.crumb" },
        ]}
        title={t("contentManager.feedback.title")}
        description={t("contentManager.feedback.description")}
        action={
          <Tooltip title={t("common.ui.refreshAria")}>
            <span>
              <Button
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                variant="outlined"
                aria-label={t("common.ui.refreshAria")}
                sx={{ minWidth: 40, width: 40, px: 0 }}
              >
                {query.isFetching ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
              </Button>
            </span>
          </Tooltip>
        }
      />

      <Box
        component="section"
        aria-label={t("contentManager.feedback.summary")}
        sx={{
          mt: 2.5,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <SummaryCard
          label={t("contentManager.feedback.pending")}
          count={data?.pending ?? 0}
          detail={t("contentManager.feedback.feedbacks")}
          tone="warning"
        />
        <SummaryCard
          label={t("contentManager.feedback.inReview")}
          count={data?.inReview ?? 0}
          detail={t("contentManager.feedback.feedbacks")}
          tone="primary"
        />
        <SummaryCard
          label={t("contentManager.feedback.escalated")}
          count={data?.escalated ?? 0}
          detail={t("contentManager.feedback.feedbacks")}
          tone="error"
        />
        <SummaryCard
          label={t("contentManager.feedback.resolved")}
          count={data?.resolved ?? 0}
          detail={t("contentManager.feedback.feedbacks")}
          tone="success"
        />
      </Box>

      <Card sx={{ mt: 2.5, overflow: "hidden" }}>
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
            SelectProps={{ SelectDisplayProps: { "aria-label": t("contentManager.feedback.filterByStatus") } }}
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
            SelectProps={{
              SelectDisplayProps: { "aria-label": t("contentManager.feedback.filterByCategory") },
            }}
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
            placeholder={t("contentManager.feedback.searchPlaceholder")}
            inputProps={{ "aria-label": t("contentManager.feedback.searchAria") }}
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
            label={t("contentManager.feedback.fromDate")}
            value={fromDate}
            onChange={(event) => {
              const next = event.target.value;
              setFromDate(next);
              if (toDate && next && toDate < next) setToDate(next);
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              max: toDate || undefined,
              "aria-label": t("contentManager.feedback.fromDateAria"),
            }}
            sx={{ ...dateFilterSx, minWidth: { xs: "100%", md: 155 } }}
          />

          <TextField
            size="small"
            type="date"
            label={t("contentManager.feedback.toDate")}
            value={toDate}
            onChange={(event) => {
              const next = event.target.value;
              setToDate(next);
              if (fromDate && next && next < fromDate) setFromDate(next);
            }}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: fromDate || undefined,
              "aria-label": t("contentManager.feedback.toDateAria"),
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
              {t("contentManager.feedback.clearFilters")}
            </Button>
          ) : null}
        </Stack>

        {query.isLoading || query.error ? (
          <EmptyState message={t("contentManager.feedback.loadFailed")} />
        ) : items.length === 0 ? (
          <EmptyState
            message={
              hasFilters
                ? t("contentManager.feedback.noMatch")
                : t("contentManager.feedback.empty")
            }
          />
        ) : (
          <TableContainer>
            <Table
              size="small"
              sx={{
                minWidth: { xs: 720, md: 880 },
                tableLayout: "fixed",
                "& .MuiTableCell-root": {
                  borderBottom: `1px solid ${CM.border}`,
                  verticalAlign: "middle",
                  py: 1.5,
                },
                // Cột nội dung chữ căn trái; các cột dữ liệu ngắn căn giữa.
                "& th:not(:first-of-type), & td:not(:first-of-type)": { textAlign: "center" },
              }}
            >
              <colgroup>
                {CONTENT_COL_SIZES.map((col) => (
                  <col key={col.key} style={{ width: col.width }} />
                ))}
              </colgroup>
              <TableHead>
                <TableRow sx={HEAD_ROW_SX}>
                  <TableCell sx={{ textAlign: "left !important", pl: 3 }}>
                    {t("contentManager.feedback.colFeedback")}
                  </TableCell>
                  <TableCell>{t("contentManager.feedback.colMember")}</TableCell>
                  <TableCell>{t("contentManager.feedback.colCategory")}</TableCell>
                  <TableCell>{t("contentManager.feedback.colStatus")}</TableCell>
                  <TableCell>{t("contentManager.feedback.colProcessed")}</TableCell>
                  <TableCell align="center">{t("contentManager.feedback.colAction")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => {
                  const meta = STATUS_META[row.status] ?? STATUS_META[STATUS.PENDING];
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell
                        sx={{
                          textAlign: "left !important",
                          pl: 3,
                          "& > .MuiStack-root": { justifyContent: "flex-start" },
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1.5,
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                              bgcolor: "rgba(139,92,246,0.16)",
                              color: CM.violetBright,
                            }}
                          >
                            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 17 }} />
                          </Box>
                          <Box sx={{ minWidth: 0, textAlign: "left" }}>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "#fff" }}>
                              {row.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ color: CM.textDim, display: "block", mt: 0.25 }}
                            >
                              {row.content}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ textAlign: "center !important" }}>
                        <Typography variant="caption" sx={{ color: CM.textMuted }}>
                          {row.memberName || t("contentManager.feedback.unknown")}
                        </Typography>
                        <Typography variant="caption" sx={{ color: CM.textDim, display: "block" }}>
                          {row.memberEmail}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: "center !important" }}>
                        <DarkPill tone="neutral">
                          {t(CATEGORY_LABEL[row.category] || CATEGORY_LABEL.OTHER)}
                        </DarkPill>
                      </TableCell>
                      <TableCell sx={{ textAlign: "center !important" }}>
                        <DarkPill tone={meta.tone}>{t(meta.labelKey)}</DarkPill>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", textAlign: "center !important" }}>
                        <Typography variant="caption" sx={{ color: CM.textDim }}>
                          {formatDateTime(row.resolvedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          component={RouterLink}
                          to={`${CONTENT_PATHS.feedback}/${encodeURIComponent(row.id)}`}
                          size="small"
                          variant="outlined"
                          sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0, whiteSpace: "nowrap" }}
                        >
                          {t("contentManager.feedback.view")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}
