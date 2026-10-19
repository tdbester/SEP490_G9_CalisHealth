import { useState } from 'react'
import {
  Container,
  Typography,
  Grid,
  TextField,
  Button,
  Card,
  CardContent,
  Stack,
  Alert,
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PhoneIcon from '@mui/icons-material/Phone'

function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSent(true)
    setForm({ name: '', email: '', message: '' })
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
        Contact
      </Typography>
      <Typography variant="h3" sx={{ mb: 2 }}>
        Get in touch
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 5, maxWidth: 720 }}>
        Questions, feedback, or partnership ideas? Drop us a line.
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <EmailIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Email</Typography>
                    <Typography variant="body2" color="text.secondary">hello@calishealth.app</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PhoneIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Phone</Typography>
                    <Typography variant="body2" color="text.secondary">+1 (555) 123-4567</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <LocationOnIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Address</Typography>
                    <Typography variant="body2" color="text.secondary">
                      123 Mobility Lane, Wellness City
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card sx={{ p: 2 }}>
            <CardContent>
              {sent && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Thanks! Your message has been sent.
                </Alert>
              )}
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <TextField
                    label="Name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <TextField
                    label="Message"
                    multiline
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                  <Button type="submit" variant="contained" size="large" sx={{ alignSelf: 'flex-start' }}>
                    Send message
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}

export default Contact
