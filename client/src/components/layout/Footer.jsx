import { Box, Container, Typography, Grid, IconButton, Stack, Divider } from '@mui/material'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import YouTubeIcon from '@mui/icons-material/YouTube'
import TwitterIcon from '@mui/icons-material/Twitter'

function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 8,
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <FitnessCenterIcon sx={{ color: 'primary.light' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'white' }}>
                CalisHealth
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              Train smart. Build strength. CalisHealth helps you master calisthenics
              through guided workouts and progressive programs.
            </Typography>
          </Grid>

          <Grid item xs={6} md={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'white' }}>
              Explore
            </Typography>
            <Stack spacing={1}>
              <a href="/workouts" style={linkStyle}>Workouts</a>
              <a href="/programs" style={linkStyle}>Programs</a>
              <a href="/about" style={linkStyle}>About</a>
            </Stack>
          </Grid>

          <Grid item xs={6} md={3}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'white' }}>
              Support
            </Typography>
            <Stack spacing={1}>
              <a href="/contact" style={linkStyle}>Contact</a>
              <a href="#" style={linkStyle}>FAQ</a>
              <a href="#" style={linkStyle}>Privacy Policy</a>
            </Stack>
          </Grid>

          <Grid item xs={12} md={3}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'white' }}>
              Follow Us
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" sx={socialBtn}><FacebookIcon fontSize="small" /></IconButton>
              <IconButton size="small" sx={socialBtn}><InstagramIcon fontSize="small" /></IconButton>
              <IconButton size="small" sx={socialBtn}><YouTubeIcon fontSize="small" /></IconButton>
              <IconButton size="small" sx={socialBtn}><TwitterIcon fontSize="small" /></IconButton>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.08)' }} />
        <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center' }}>
          © {new Date().getFullYear()} CalisHealth. All rights reserved.
        </Typography>
      </Container>
    </Box>
  )
}

const linkStyle = {
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: 14,
}

const socialBtn = {
  color: '#cbd5e1',
  backgroundColor: 'rgba(255,255,255,0.06)',
  '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' },
}

export default Footer
