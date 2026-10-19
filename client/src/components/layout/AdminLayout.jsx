import { Box } from "@mui/material";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminLayout({ children }) {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
      <Sidebar />
      <Topbar />
      <Box
        component="main"
        sx={{
          ml: "var(--sidebar-width)",
          pt: "calc(var(--header-height) + 28px)",
          px: 4,
          pb: 4,
          minHeight: "100vh",
          backgroundColor: "background.default", // white canvas
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
