import { Box, Paper, Typography, Stack, Chip } from "@mui/material";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";

export default function PlaceholderPage({ title, description }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        <Chip label="Sắp ra mắt" color="primary" variant="outlined" size="small" />
      </Stack>
      <Paper sx={{ p: 6, textAlign: "center" }}>
        <ConstructionRoundedIcon
          sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
        />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Tính năng đang được phát triển
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 480, mx: "auto" }}>
          Màn này sẽ được bổ sung ở sprint tiếp theo. Vui lòng quay lại sau.
        </Typography>
      </Paper>
    </Box>
  );
}
