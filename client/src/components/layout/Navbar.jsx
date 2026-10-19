import { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Container,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import { NavLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Workouts', path: '/workouts' },
  { label: 'Programs', path: '/programs' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
]

function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        color: 'text.primary',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Typography
            component={NavLink}
            to="/"
            variant="h6"
            sx={{
              fontWeight: 800,
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <FitnessCenterIcon sx={{ color: 'primary.main' }} />
            CalisHealth
          </Typography>

          {/* Desktop nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.path}
                component={NavLink}
                to={item.path}
                color={isActive(item.path) ? 'primary' : 'inherit'}
                sx={{ fontWeight: isActive(item.path) ? 700 : 500 }}
              >
                {item.label}
              </Button>
            ))}
            <Button variant="contained" color="primary" sx={{ ml: 1 }}>
              Get Started
            </Button>
          </Box>

          {/* Mobile toggle */}
          <IconButton
            edge="end"
            color="inherit"
            aria-label="menu"
            onClick={() => setOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      {/* Mobile drawer */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 240, pt: 2 }} role="presentation" onClick={() => setOpen(false)}>
          <List>
            {NAV_ITEMS.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton component={NavLink} to={item.path}>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: isActive(item.path) ? 700 : 500,
                      color: isActive(item.path) ? 'primary.main' : 'text.primary',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  )
}

export default Navbar
