import {
  Box,
  Paper,
  Typography,
  Stack,
  Grid,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  LinearProgress,
} from "@mui/material";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import AssignmentLateRoundedIcon from "@mui/icons-material/AssignmentLateRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";

const STATS = [
  {
    label: "Khảo sát chờ duyệt",
    value: 12,
    delta: "+3 hôm nay",
    icon: <AssignmentLateRoundedIcon />,
    tone: "primary",
  },
  {
    label: "Bài tập mới",
    value: 38,
    delta: "+8 tuần này",
    icon: <FitnessCenterRoundedIcon />,
    tone: "secondary",
  },
  {
    label: "Người dùng hoạt động",
    value: "1,284",
    delta: "+12% so với tháng trước",
    icon: <PeopleAltRoundedIcon />,
    tone: "success",
  },
  {
    label: "Tiến trình cập nhật",
    value: "76%",
    delta: "Mục tiêu tháng",
    icon: <TrendingUpRoundedIcon />,
    tone: "primary",
  },
];

const RECENT = [
  {
    title: "Nguyễn Văn A đã hoàn thành Level 3 - Push",
    time: "5 phút trước",
    color: "#0F766E",
  },
  {
    title: "Khảo sát mới từ Trần Thị B",
    time: "23 phút trước",
    color: "#B91C1C",
  },
  {
    title: "Bài tập 'Planche Lean' được cập nhật",
    time: "1 giờ trước",
    color: "#0F766E",
  },
  {
    title: "12 người dùng mới đăng ký",
    time: "Hôm nay, 09:14",
    color: "#B91C1C",
  },
];

function StatCard({ stat }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        height: "100%",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {stat.label}
        </Typography>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            backgroundColor:
              stat.tone === "primary"
                ? "primary.main"
                : stat.tone === "secondary"
                ? "secondary.main"
                : "success.main",
          }}
        >
          {stat.icon}
        </Avatar>
      </Stack>
      <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1 }}>
        {stat.value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {stat.delta}
      </Typography>
    </Paper>
  );
}

export default function Dashboard() {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tổng quan hoạt động hệ thống CalisHealth
          </Typography>
        </Box>
        <Chip
          label="Cập nhật: hôm nay"
          color="primary"
          variant="outlined"
          size="small"
        />
      </Stack>

      {/* Stat cards */}
      <Grid container spacing={2.5} mb={3}>
        {STATS.map((s) => (
          <Grid item xs={12} sm={6} md={3} key={s.label}>
            <StatCard stat={s} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Recent activity */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 0, height: "100%" }}>
            <Box sx={{ p: 2.5, pb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Hoạt động gần đây
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Các sự kiện mới nhất trong hệ thống
              </Typography>
            </Box>
            <Divider />
            <List disablePadding>
              {RECENT.map((r, i) => (
                <Box key={i}>
                  <ListItem
                    secondaryAction={
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <AccessTimeRoundedIcon
                          sx={{ fontSize: 14, color: "text.secondary" }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {r.time}
                        </Typography>
                      </Stack>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          backgroundColor: r.color,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {r.title.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={r.title}
                      primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 500 }}
                    />
                  </ListItem>
                  {i < RECENT.length - 1 && <Divider component="li" />}
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Goal progress */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5, height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Tiến trình mục tiêu tháng
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Hoàn thành kế hoạch cập nhật nội dung tháng 10
            </Typography>

            <Stack spacing={2.5}>
              {[
                { label: "Bài tập mới", value: 38, total: 50, color: "primary.main" },
                { label: "Khảo sát đã duyệt", value: 24, total: 30, color: "secondary.main" },
                { label: "Quy tắc thăng tiến", value: 8, total: 12, color: "primary.main" },
                { label: "Tiêu chí lên cấp", value: 5, total: 10, color: "secondary.main" },
              ].map((g) => {
                const pct = Math.round((g.value / g.total) * 100);
                return (
                  <Box key={g.label}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="baseline"
                      mb={0.5}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {g.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {g.value}/{g.total} ({pct}%)
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "rgba(0,0,0,0.05)",
                        "& .MuiLinearProgress-bar": {
                          backgroundColor: g.color,
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
