// CalisHealth theme - based on Content Manager admin panel mockup
// Sidebar: DEEP PURPLE background with WHITE text
// Active menu item: LIGHT PURPLE background, DEEP PURPLE text
// Main canvas: very light gray (#F9FAFB)
// Cards: white

import { createTheme } from "@mui/material/styles";

// Deep purple - main brand color (sidebar bg, primary CTAs)
const PRIMARY = "#5B21B6"; // deep purple/violet
const PRIMARY_DARK = "#4C1D95"; // darker purple - hover
const PRIMARY_SOFT = "#EDE9FE"; // purple-100 - active item bg
const PRIMARY_SOFT_HOVER = "#DDD6FE"; // purple-200 - active hover

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: PRIMARY,
      light: "#7C3AED", // violet-600
      dark: PRIMARY_DARK,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: PRIMARY,
      light: "#7C3AED",
      dark: PRIMARY_DARK,
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F9FAFB", // very light gray canvas (per mockup)
      paper: "#FFFFFF",
    },
    text: {
      primary: "#111827",   // gray-900 - headings
      secondary: "#6B7280", // gray-500 - muted body
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
          color: "#111827",
          "&:hover": {
            borderColor: PRIMARY,
            backgroundColor: "#F5F3FF", // purple-50
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit" },
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
        },
      },
    },
    // Sidebar nav: white text on deep purple; active = light purple pill with deep purple text
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginInline: 12,
          marginBlock: 2,
          paddingBlock: 10,
          paddingInline: 14,
          color: "#FFFFFF", // white text on purple sidebar
          "& .MuiListItemIcon-root": { color: "#FFFFFF", minWidth: 36 },
          "&:hover": {
            backgroundColor: PRIMARY_DARK,
          },
          "&.Mui-selected": {
            backgroundColor: PRIMARY_SOFT,
            color: PRIMARY,
            "& .MuiListItemIcon-root": { color: PRIMARY },
            "&:hover": { backgroundColor: PRIMARY_SOFT_HOVER },
          },
        },
      },
    },
  },
});

export default theme;
