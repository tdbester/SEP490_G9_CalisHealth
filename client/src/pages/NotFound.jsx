import { Container, Typography, Button, Box } from '@mui/material'
import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
      <Typography variant="h1" sx={{ fontSize: { xs: 80, md: 120 }, fontWeight: 800, mb: 2 }}>
        404
      </Typography>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Page not found
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Box>
        <Button component={Link} to="/" variant="contained" size="large">
          Back to Home
        </Button>
      </Box>
    </Container>
  )
}

export default NotFound
