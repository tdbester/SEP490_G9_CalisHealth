import { Box, Container, Typography, Button, Grid, Card, CardContent, CardActions, Stack, Chip } from '@mui/material'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement'
import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: <FitnessCenterIcon sx={{ fontSize: 40 }} />,
    title: 'Strength Workouts',
    desc: 'Progressive push-ups, pull-ups, and squat routines for every level.',
  },
  {
    icon: <DirectionsRunIcon sx={{ fontSize: 40 }} />,
    title: 'Mobility & Cardio',
    desc: 'Dynamic warmups and conditioning flows to keep you moving well.',
  },
  {
    icon: <SelfImprovementIcon sx={{ fontSize: 40 }} />,
    title: 'Mindful Recovery',
    desc: 'Breathwork and cooldown sessions to support recovery and balance.',
  },
]

const STATS = [
  { value: '120+', label: 'Workouts' },
  { value: '8', label: 'Programs' },
  { value: '25k', label: 'Active Users' },
  { value: '4.8★', label: 'Avg Rating' },
]

function Home() {
  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #e0f7f5 0%, #fff4ee 100%)',
          py: { xs: 8, md: 14 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip
                label="Calisthenic for everyone"
                color="primary"
                variant="outlined"
                sx={{ mb: 3, fontWeight: 600 }}
              />
              <Typography variant="h2" sx={{ mb: 2, fontSize: { xs: 36, md: 56 } }}>
                Build your body with <span className="gradient-text">calisthenics</span>.
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mb: 4 }}>
                CalisHealth guides you through progressive bodyweight workouts
                and structured programs — no gym required.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button component={Link} to="/workouts" variant="contained" size="large">
                  Start training
                </Button>
                <Button component={Link} to="/programs" variant="outlined" size="large">
                  Browse programs
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  aspectRatio: '4 / 5',
                  borderRadius: 6,
                  backgroundImage:
                    'linear-gradient(135deg, rgba(0,184,169,0.15) 0%, rgba(255,112,67,0.18) 100%)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FitnessCenterIcon sx={{ fontSize: 140, color: 'primary.main', opacity: 0.8 }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Grid container spacing={2}>
          {STATS.map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Card sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="h4" color="primary.main" sx={{ fontWeight: 800 }}>
                  {s.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features */}
      <Box className="section" sx={{ backgroundColor: 'background.paper' }}>
        <div className="section-inner">
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
            Why CalisHealth
          </Typography>
          <Typography variant="h3" sx={{ mb: 6, mt: 1 }}>
            Everything you need to train smarter
          </Typography>
          <Grid container spacing={4}>
            {FEATURES.map((f) => (
              <Grid item xs={12} md={4} key={f.title}>
                <Card className="card-hover" sx={{ height: '100%', p: 1 }}>
                  <CardContent>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>{f.icon}</Box>
                    <Typography variant="h5" sx={{ mb: 1 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </div>
      </Box>

      {/* CTA */}
      <Container maxWidth="md" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          Ready to start your calisthenic journey?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Pick a program, follow it consistently, and watch your strength grow.
        </Typography>
        <Button component={Link} to="/programs" variant="contained" size="large">
          Choose a program
        </Button>
      </Container>
    </Box>
  )
}

export default Home
