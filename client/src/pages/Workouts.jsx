import { useState, useMemo } from 'react'
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Box,
  TextField,
  MenuItem,
  Stack,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'

// Placeholder dataset (replace with API later)
const WORKOUTS = [
  { id: 1, name: 'Push Fundamentals', level: 'Beginner', duration: 20, kcal: 150, focus: 'Push' },
  { id: 2, name: 'Pull Strength Builder', level: 'Intermediate', duration: 35, kcal: 280, focus: 'Pull' },
  { id: 3, name: 'Leg Power Circuit', level: 'Beginner', duration: 25, kcal: 220, focus: 'Legs' },
  { id: 4, name: 'Core Stability Flow', level: 'Beginner', duration: 15, kcal: 120, focus: 'Core' },
  { id: 5, name: 'Advanced Handstand Drills', level: 'Advanced', duration: 45, kcal: 320, focus: 'Skill' },
  { id: 6, name: 'Full Body Mobility', level: 'Beginner', duration: 30, kcal: 180, focus: 'Mobility' },
]

function Workouts() {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('All')

  const filtered = useMemo(() => {
    return WORKOUTS.filter((w) => {
      const matchesQuery = w.name.toLowerCase().includes(query.toLowerCase())
      const matchesLevel = level === 'All' || w.level === level
      return matchesQuery && matchesLevel
    })
  }, [query, level])

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
        Workouts
      </Typography>
      <Typography variant="h3" sx={{ mb: 2 }}>
        Find your next session
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 720 }}>
        Filter by level or search to discover workouts tailored to your goals.
      </Typography>

      {/* Filters */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 4, maxWidth: 720 }}
      >
        <TextField
          fullWidth
          label="Search workouts"
          variant="outlined"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <TextField
          select
          label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {['All', 'Beginner', 'Intermediate', 'Advanced'].map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* Cards */}
      <Grid container spacing={3}>
        {filtered.map((w) => (
          <Grid item xs={12} sm={6} md={4} key={w.id}>
            <Card className="card-hover" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Chip
                    label={w.level}
                    size="small"
                    color={w.level === 'Beginner' ? 'success' : w.level === 'Intermediate' ? 'warning' : 'error'}
                  />
                  <Chip label={w.focus} size="small" variant="outlined" />
                </Stack>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  {w.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, color: 'text.secondary' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTimeIcon fontSize="small" />
                    <Typography variant="body2">{w.duration} min</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocalFireDepartmentIcon fontSize="small" />
                    <Typography variant="body2">{w.kcal} kcal</Typography>
                  </Box>
                </Box>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button size="small" variant="contained">Start</Button>
                <Button size="small">Details</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">No workouts match your filters.</Typography>
        </Box>
      )}
    </Container>
  )
}

export default Workouts
