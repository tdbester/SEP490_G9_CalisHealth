import { Container, Typography, Grid, Card, CardContent, Avatar, Box } from '@mui/material'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'

const VALUES = [
  { title: 'Inclusive', desc: 'Training that adapts to every body and skill level.' },
  { title: 'Progressive', desc: 'Step-by-step overload so you grow without injury.' },
  { title: 'Free', desc: 'Open access to our core workouts and programs.' },
]

const TEAM = [
  { name: 'Alex Chen', role: 'Founder & Coach' },
  { name: 'Maya Patel', role: 'Mobility Specialist' },
  { name: 'Liam Rivera', role: 'Program Designer' },
]

function About() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
        About Us
      </Typography>
      <Typography variant="h3" sx={{ mb: 2 }}>
        Built by athletes, for everyone
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 6, maxWidth: 760 }}>
        CalisHealth was created to make calisthenics approachable. We combine
        bodyweight training with modern coaching to help you build strength,
        control, and confidence.
      </Typography>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        {VALUES.map((v) => (
          <Grid item xs={12} md={4} key={v.title}>
            <Card className="card-hover" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 1 }}>{v.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {v.desc}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Meet the team
      </Typography>
      <Grid container spacing={3}>
        {TEAM.map((m) => (
          <Grid item xs={12} sm={6} md={4} key={m.name}>
            <Card sx={{ textAlign: 'center', py: 4 }} className="card-hover">
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 2,
                  backgroundColor: 'primary.main',
                }}
              >
                <FitnessCenterIcon />
              </Avatar>
              <CardContent>
                <Typography variant="h6">{m.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {m.role}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}

export default About
