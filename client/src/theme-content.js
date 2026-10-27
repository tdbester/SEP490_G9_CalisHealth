// theme-content.js — dark violet theme for the Content Manager area.
// Palette taken from the design reference: near-black violet sidebar,
// deep violet canvas, slightly lighter card surfaces, violet accents.

import { createTheme } from "@mui/material/styles";

export const CM = {
  sidebar: "#130A27",
  sidebarBorder: "rgba(150,124,255,0.14)",
  bg: "#150C2B",
  surface: "#1E1240",
  surfaceAlt: "#241748",
  surfaceSoft: "#1A1038",
  border: "rgba(150,124,255,0.16)",
  borderStrong: "rgba(160,132,255,0.32)",
  text: "#FFFFFF",
  textMuted: "#A89BD0",
  textDim: "#7C6BA6",
  violet: "#8B5CF6",
  violetBright: "#A78BFA",
  violetDeep: "#6D28D9",
  gradient: "linear-gradient(135deg, #B44CFF 0%, #FF77A8 100%)",
  gradientSoft: "linear-gradient(135deg, #3A2C7B 0%, #392B7A 100%)",
  buttonGradient: "linear-gradient(135deg, #8B5CF6 0%, #C026D3 100%)",
  green: "#78E888",
  amber: "#F8C858",
  pink: "#FF7799",
};

const contentTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: CM.violet,
      light: CM.violetBright,
      dark: CM.violetDeep,
      contrastText: "#FFFFFF",
    },
    secondary: { main: CM.pink, contrastText: "#1A0B2E" },
    background: { default: CM.bg, paper: CM.surface },
    text: { primary: CM.text, secondary: CM.textMuted, disabled: CM.textDim },
    divider: CM.border,
    success: { main: CM.green, dark: CM.green, contrastText: "#0B1F12" },
    warning: { main: CM.amber, dark: CM.amber, contrastText: "#241A02" },
    error: { main: CM.pink, dark: CM.pink, contrastText: "#2A0716" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: "2.1rem", letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, fontSize: "1.8rem", letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, fontSize: "1.5rem", letterSpacing: "-0.015em" },
    h4: { fontWeight: 700, fontSize: "1.35rem", letterSpacing: "-0.015em" },
    h5: { fontWeight: 700, fontSize: "1.15rem" },
    h6: { fontWeight: 700, fontSize: "1rem" },
    body1: { fontSize: "0.9rem", lineHeight: 1.6 },
    body2: { fontSize: "0.85rem", lineHeight: 1.6 },
    caption: { fontSize: "0.75rem", lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: CM.bg,
          color: CM.text,
          backgroundImage:
            "radial-gradient(900px 420px at 18% -8%, rgba(139,92,246,0.16), transparent 70%), radial-gradient(760px 380px at 100% 0%, rgba(192,38,211,0.12), transparent 65%)",
          backgroundAttachment: "fixed",
        },
        "::selection": { background: "rgba(167,139,250,0.35)" },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: CM.surface,
          backgroundImage:
            "linear-gradient(160deg, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 42%)",
          border: `1px solid ${CM.border}`,
          borderRadius: 16,
          boxShadow: "0 18px 40px rgba(8,3,22,0.45)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: "none", fontWeight: 600, paddingInline: 16 },
        contained: {
          backgroundImage: CM.buttonGradient,
          color: "#FFFFFF",
          boxShadow: "0 10px 24px rgba(139,92,246,0.35)",
          "&:hover": {
            backgroundImage: "linear-gradient(135deg, #9B6BFF 0%, #D135E0 100%)",
            boxShadow: "0 12px 28px rgba(139,92,246,0.45)",
          },
        },
        outlined: {
          borderColor: CM.borderStrong,
          color: CM.text,
          backgroundColor: "rgba(139,92,246,0.08)",
          "&:hover": {
            borderColor: CM.violetBright,
            backgroundColor: "rgba(139,92,246,0.18)",
          },
        },
        text: {
          color: CM.textMuted,
          "&:hover": { color: CM.text, backgroundColor: "rgba(139,92,246,0.12)" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: CM.surfaceSoft,
          borderRadius: 10,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: CM.border },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: CM.borderStrong },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: CM.violet,
            borderWidth: 1,
          },
        },
        input: { "&::placeholder": { color: CM.textDim, opacity: 1 } },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: CM.textMuted } } },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: CM.surfaceAlt,
          border: `1px solid ${CM.border}`,
          borderRadius: 12,
          boxShadow: "0 18px 40px rgba(8,3,22,0.55)",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 13.5,
          color: CM.textMuted,
          "&:hover": { backgroundColor: "rgba(139,92,246,0.14)", color: CM.text },
          "&.Mui-selected": { backgroundColor: "rgba(139,92,246,0.22)", color: CM.text },
        },
      },
    },
    MuiTable: { styleOverrides: { root: { borderCollapse: "separate", borderSpacing: 0 } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid rgba(150,124,255,0.10)`, paddingBlock: 10 },
        head: {
          backgroundColor: "rgba(19,10,39,0.85)",
          color: CM.textMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          borderBottom: `1px solid ${CM.border}`,
        },
        body: { fontSize: 13 },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "rgba(139,92,246,0.07)" },
          "&:last-child td": { borderBottom: "none" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999, borderColor: CM.borderStrong },
        filled: { backgroundColor: "rgba(139,92,246,0.18)", color: CM.text },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: CM.gradient, height: 2, borderRadius: 2 },
        root: { minHeight: 38 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 38,
          fontSize: 13,
          fontWeight: 600,
          textTransform: "none",
          color: CM.textMuted,
          "&.Mui-selected": { color: CM.text },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: CM.border } } },
    MuiBreadcrumbs: { styleOverrides: { separator: { color: CM.textDim } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: `1px solid ${CM.border}`, fontSize: 13 },
        standardError: { backgroundColor: "rgba(255,119,153,0.12)", color: "inherit" },
        standardSuccess: { backgroundColor: "rgba(120,232,136,0.12)", color: "inherit" },
        standardWarning: { backgroundColor: "rgba(248,200,88,0.12)", color: "inherit" },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { color: CM.textMuted, borderTop: `1px solid ${CM.border}` },
        selectIcon: { color: CM.textMuted },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: "rgba(139,92,246,0.14)" } },
    },
    MuiCircularProgress: { styleOverrides: { root: { color: CM.violetBright } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: CM.surfaceAlt,
          border: `1px solid ${CM.border}`,
          fontSize: 11.5,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { color: CM.textMuted, "&:hover": { color: CM.text } },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { gap: 6, "& .MuiToggleButtonGroup-grouped": { borderRadius: "8px !important", border: `1px solid ${CM.border} !important`, margin: 0 } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: CM.textMuted,
          backgroundColor: CM.surfaceSoft,
          fontSize: 12.5,
          fontWeight: 600,
          paddingBlock: 6,
          "&:hover": { backgroundColor: "rgba(139,92,246,0.14)", color: CM.text },
          "&.Mui-selected": {
            background: CM.buttonGradient,
            color: "#fff",
            "&:hover": { background: CM.buttonGradient },
          },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: { color: "rgba(139,92,246,0.25)", "&.Mui-active": { color: CM.violet }, "&.Mui-completed": { color: CM.violetBright } },
        text: { fill: "#fff" },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: { color: CM.textMuted, fontSize: 12.5, "&.Mui-active": { color: "#fff", fontWeight: 600 }, "&.Mui-completed": { color: CM.textMuted } },
      },
    },
    MuiStepConnector: { styleOverrides: { line: { borderColor: CM.border } } },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: CM.surfaceAlt, border: `1px solid ${CM.border}`, borderRadius: 16, backgroundImage: "none" },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 16, fontWeight: 700, color: "#fff" } } },
    MuiSelect: { styleOverrides: { icon: { color: CM.textMuted } } },
    MuiFormHelperText: { styleOverrides: { root: { color: CM.textDim, marginLeft: 0 } } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: "rgba(139,92,246,0.16)", borderRadius: 999 },
        bar: { backgroundImage: CM.buttonGradient, borderRadius: 999 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": { backgroundColor: "rgba(139,92,246,0.18)" },
          "&.Mui-selected:hover": { backgroundColor: "rgba(139,92,246,0.24)" },
        },
      },
    },
    MuiContainer: { styleOverrides: {} },
  },
});

export default contentTheme;
