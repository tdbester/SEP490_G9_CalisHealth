// CalisHealth theme - based on Content Manager admin panel mockup
// Sidebar: DEEP RED background with WHITE text
// Active menu item: WHITE background, RED text
// Main canvas: WHITE
// Cards: white, subtle shadow

import { createTheme } from "@mui/material/styles";

const SIDEBAR_BG = "#B91C1C"; // deep red - sidebar background
const SIDEBAR_BG_DARK = "#7F1D1D"; // darker red for hover
const ACTIVE_BG = "#FFFFFF"; // white pill for active menu
const ACTIVE_TEXT = "#B91C1C";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#B91C1C", // deep red - brand & sidebar
      light: "#DC2626",
      dark: "#7F1D1D",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#B91C1C", // keep secondary aligned with primary for consistency
      light: "#DC2626",
      dark: "#7F1D1D",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FFFFFF", // main canvas - white per mockup
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1F2937",   // slate-900
      secondary: "#6B7280", // gray-500
    },
    divider: "#E5E7EB",
    error: { main: "#DC2626" },
    success: { main: "#10B981" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: "2.25rem", letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, fontSize: "1.875rem", letterSpacing: "-0.01em" },
    h3: { fontWeight: 600, fontSize: "1.5rem" },
    h4: { fontWeight: 600, fontSize: "1.25rem" },
    h5: { fontWeight: 600, fontSize: "1.125rem" },
    h6: { fontWeight: 600, fontSize: "1rem" },
    body1: { fontSize: "0.95rem", lineHeight: 1.55 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: "none", fontWeight: 600 },
        outlined: {
          borderColor: "#E5E7EB",
          color: "#1F2937",
          "&:hover": { borderColor: "#B91C1C", backgroundColor: "#FEF2F2" },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        },
      },
    },
    // Sidebar ListItemButton: white pill when active, transparent when not
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginInline: 12,
          marginBlock: 2,
          paddingBlock: 10,
          paddingInline: 14,
          color: "#FFFFFF", // white text on red sidebar
          "& .MuiListItemIcon-root": { color: "#FFFFFF", minWidth: 36 },
          "&:hover": {
            backgroundColor: SIDEBAR_BG_DARK,
          },
          "&.Mui-selected": {
            backgroundColor: ACTIVE_BG,
            color: ACTIVE_TEXT,
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            "& .MuiListItemIcon-root": { color: ACTIVE_TEXT },
            "&:hover": { backgroundColor: ACTIVE_BG },
          },
        },
      },
    },
  },
});

export default theme;
