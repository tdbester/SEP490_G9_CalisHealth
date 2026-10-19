import { createTheme } from '@mui/material/styles'

// CalisHealth brand theme
// Primary: energetic teal/cyan | Secondary: warm orange
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00B8A9',
      light: '#43D4CB',
      dark: '#008579',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FF7043',
      light: '#FFA270',
      dark: '#C53D13',
      contrastText: '#ffffff',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1F2937',
      secondary: '#4B5563',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 20,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
})
