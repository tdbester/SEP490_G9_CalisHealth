import { Alert, Box, Button, Card, CircularProgress, Stack, Typography } from "@mui/material";
import { ContentPageHeader } from "../components/ContentShared";
import { CM } from "../theme-content";

/**
 * Khung chung cho các màn hình Content Manager chỉ đọc dữ liệu từ DB:
 * loading / lỗi / nội dung. Giữ style tối giống Exercise list.
 */
export default function ContentDataCard({ query, title, children }) {
  const { isLoading, error, refetch } = query;

  if (isLoading) {
    return (
      <Card sx={{ mt: 2.5, py: 8, display: "grid", placeItems: "center" }}>
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Loading data from the database…
          </Typography>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mt: 2.5, p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          Could not load {title || "this data"}. {error.message}
        </Alert>
      </Card>
    );
  }

  return <Card sx={{ mt: 2.5, overflow: "hidden" }}>{children}</Card>;
}

export function EmptyState({ message }) {
  return (
    <Box sx={{ py: 6, px: 2, textAlign: "center" }}>
      <Typography variant="body2" sx={{ color: CM.textMuted }}>
        {message}
      </Typography>
    </Box>
  );
}

export const HEAD_ROW_SX = {
  "& th": {
    bgcolor: "rgba(19,10,39,0.85)",
    color: CM.textMuted,
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    whiteSpace: "nowrap",
  },
};

export function DbSourceNote({ children }) {
  return (
    <Typography variant="caption" sx={{ display: "block", mt: 1.5, color: CM.textDim }}>
      {children}
    </Typography>
  );
}

export { ContentPageHeader };
