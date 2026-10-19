import { Container, Typography, Grid, Card, CardContent, CardActions, Button, LinearProgress, Stack, Chip } from '@mui/material'

const PROGRAMS = [
  { id: 'p1', name: 'Foundations 4-Week', weeks: 4, level: 'Beginner', progress: 0 },
  { id: 'p2', name: 'Pull-Up Hero', weeks: 6, level: 'Intermediate', progress: 35 },
  { id: 'p3', name: 'Handstand Pathway', weeks: 8, level: 'Advanced', progress: 10 },
  { id: 'p4', name: 'Mobility Reset', weeks: 3, level: 'Beginner', progress: 0 },
]

function Programs() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
        Programs
      </Typography>
      <Typography variant="h3" sx={{ mb: 2 }}>
        Structured plans that build habits
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5, maxWidth: 720 }}>
        Multi-week programs designed for progressive overload and recovery.
      </Typography>

      <Grid container spacing={3}>
        {PROGRAMS.map((p) => (
          <Grid item xs={12} md={6} key={p.id}>
            <Card className="card-hover" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Chip
                    label={p.level}
                    size="small"
                    color={p.level === 'Beginner' ? 'success' : p.level === 'Intermediate' ? 'warning' : 'error'}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {p.weeks} weeks
                  </Typography>
                </Stack>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  {p.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Progress
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={p.progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {p.progress}% complete
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button size="small" variant="contained">{p.progress > 0 ? 'Continue' : 'Start'}</Button>
                <Button size="small">Preview</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}

export default Programs
