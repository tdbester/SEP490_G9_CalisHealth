import { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TablePagination,
  Chip,
  MenuItem,
  Select,
  FormControl,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";

// Mock data - replace with API later
const ROWS = [
  { id: 1, name: "Nguyễn Văn A",  email: "a.nguyen@calishealth.vn", level: "Level 3 - Push",    status: "Đang tập",       progress: 72, lastUpdate: "5 phút trước" },
  { id: 2, name: "Trần Thị B",    email: "b.tran@calishealth.vn",   level: "Level 2 - Pull",    status: "Hoàn thành",     progress: 100, lastUpdate: "23 phút trước" },
  { id: 3, name: "Lê Văn C",      email: "c.le@calishealth.vn",     level: "Level 4 - Core",    status: "Đang tập",       progress: 45, lastUpdate: "1 giờ trước" },
  { id: 4, name: "Phạm Thị D",    email: "d.pham@calishealth.vn",   level: "Level 1 - Basics",  status: "Chờ duyệt",      progress: 10, lastUpdate: "2 giờ trước" },
  { id: 5, name: "Hoàng Văn E",   email: "e.hoang@calishealth.vn",  level: "Level 3 - Push",    status: "Đang tập",       progress: 68, lastUpdate: "Hôm nay, 09:14" },
  { id: 6, name: "Đỗ Thị F",      email: "f.do@calishealth.vn",     level: "Level 5 - Skills",  status: "Hoàn thành",     progress: 100, lastUpdate: "Hôm qua" },
  { id: 7, name: "Vũ Văn G",      email: "g.vu@calishealth.vn",     level: "Level 2 - Pull",    status: "Đang tập",       progress: 55, lastUpdate: "Hôm qua" },
  { id: 8, name: "Bùi Thị H",     email: "h.bui@calishealth.vn",    level: "Level 4 - Core",    status: "Tạm dừng",       progress: 30, lastUpdate: "2 ngày trước" },
];

const STATUS_COLOR = {
  "Đang tập":     { bg: "#DBEAFE", fg: "#1E40AF" }, // blue
  "Hoàn thành":   { bg: "#D1FAE5", fg: "#065F46" }, // green
  "Chờ duyệt":    { bg: "#FEF3C7", fg: "#92400E" }, // amber
  "Tạm dừng":     { bg: "#FEE2E2", fg: "#991B1B" }, // red
};

function StatusChip({ status }) {
  const c = STATUS_COLOR[status] || { bg: "#F3F4F6", fg: "#374151" };
  return (
    <Chip
      label={status}
      size="small"
      sx={{
        backgroundColor: c.bg,
        color: c.fg,
        fontWeight: 600,
        fontSize: "0.75rem",
        height: 24,
      }}
    />
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const filtered = useMemo(() => {
    return ROWS.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase());
      const matchLevel = levelFilter === "all" || r.level === levelFilter;
      return matchSearch && matchLevel;
    });
  }, [search, levelFilter]);

  const pageRows = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Page title */}
      <Stack mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Theo dõi sức khỏe & tiến trình
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quản lý tiến trình tập luyện và sức khỏe của người dùng
        </Typography>
      </Stack>

      {/* Filter bar */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        mb={2.5}
      >
        <TextField
          placeholder="Tìm kiếm theo tên hoặc email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, maxWidth: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={levelFilter}
            displayEmpty
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <MenuItem value="all">Tất cả level</MenuItem>
            <MenuItem value="Level 1 - Basics">Level 1 - Basics</MenuItem>
            <MenuItem value="Level 2 - Pull">Level 2 - Pull</MenuItem>
            <MenuItem value="Level 3 - Push">Level 3 - Push</MenuItem>
            <MenuItem value="Level 4 - Core">Level 4 - Core</MenuItem>
            <MenuItem value="Level 5 - Skills">Level 5 - Skills</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />

        <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />}>
          Xuất Excel
        </Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />}>
          Thêm người dùng
        </Button>
      </Stack>

      {/* Data table */}
      <Paper sx={{ overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#F9FAFB" }}>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>STT</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Họ và tên</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Level</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Trạng thái</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Tiến trình</TableCell>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Cập nhật</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: "text.secondary" }}>
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((row, idx) => (
                <TableRow key={row.id} hover>
                  <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{row.email}</TableCell>
                  <TableCell>{row.level}</TableCell>
                  <TableCell>
                    <StatusChip status={row.status} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 120 }}>
                      <Box
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: "#F3F4F6",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${row.progress}%`,
                            height: "100%",
                            backgroundColor: row.progress === 100 ? "#10B981" : "primary.main",
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ minWidth: 32, color: "text.secondary" }}>
                        {row.progress}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{row.lastUpdate}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small">
                      <MoreHorizRoundedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 8, 16, 32]}
          labelRowsPerPage="Số hàng mỗi trang:"
          labelDisplayedRows={({ from, to, count }) =>
            `Hiển thị ${from} đến ${to} của ${count} mục`
          }
        />
      </Paper>
    </Box>
  );
}
