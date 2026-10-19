// CalisHealth theme - based on Content Manager admin panel
// Primary brand: deep red (matches active sidebar item in mockup)
// Layout: clean white surfaces, subtle borders, generous spacing

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#B91C1C", // deep red - sidebar active state / brand
      light: "#DC2626",
      dark: "#7F1D1D",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#0F766E", // teal accent (calisthenic / health vibe)
      light: "#14B8A6",
      dark: "#0B4F4A",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F5F5F7", // main canvas - soft off-white
      paper: "#FFFFFF",   // sidebar / header / cards
    },
    text: {
      primary: "#1F2937",   // slate-900
      secondary: "#6B7280", // gray-500
    },
    divider: "#E5E7EB", // gray-200
    error: { main: "#DC2626" },
    success: { main: "#10B981" },
  },
  typography: {
    fontFamily:
      '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
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
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 16 },
        containedPrimary: {
          boxShadow: "none",
          "&:hover": { boxShadow: "0 1px 3px rgba(185,28,28,0.25)" },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #E5E7EB" },
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
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginInline: 8,
          marginBlock: 2,
          paddingBlock: 10,
          "&.Mui-selected": {
            backgroundColor: "#FEE2E2", // red-100
            color: "#B91C1C",
            "& .MuiListItemIcon-root": { color: "#B91C1C" },
            "&:hover": { backgroundColor: "#FECACA" },
          },
        },
      },
    },
  },
});

export default theme;
