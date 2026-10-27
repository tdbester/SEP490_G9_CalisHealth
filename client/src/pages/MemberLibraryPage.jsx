import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { libraryApi } from "../api/client";
import { useApiQuery } from "../hooks";
import "./MemberLibraryPage.css";

const titleCase = (value) => String(value || "").replace(/\b\w/g, (char) => char.toUpperCase());

export default function MemberLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "community" ? "workouts" : "exercises";
  const muscleFilter = searchParams.get("muscle");
  const skillFilter = searchParams.get("skill");
  const [search, setSearch] = useState("");
  const exercisesQuery = useApiQuery(() => libraryApi.exercises());
  const workoutsQuery = useApiQuery(() => libraryApi.workouts());

  const entries = useMemo(() => {
    const all = tab === "exercises" ? exercisesQuery.data : workoutsQuery.data;
    if (!Array.isArray(all)) return [];
    const term = search.trim().toLowerCase();
    return all.filter((entry) => {
      const matchesSearch = !term || [entry.name, entry.code, entry.description, entry.muscleGroup]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const normalizedType = String(entry.type || "").toLowerCase();
      const normalizedGroup = String(entry.muscleGroup || "").toLowerCase();
      const matchesMuscle = !muscleFilter || normalizedGroup.includes(muscleFilter.toLowerCase());
      const matchesSkill = !skillFilter || normalizedType === "skill" || normalizedGroup.includes(skillFilter.toLowerCase());
      return matchesSearch && matchesMuscle && matchesSkill;
    });
  }, [tab, search, muscleFilter, skillFilter, exercisesQuery.data, workoutsQuery.data]);

  const isLoading = tab === "exercises" ? exercisesQuery.isLoading : workoutsQuery.isLoading;
  const error = tab === "exercises" ? exercisesQuery.error : workoutsQuery.error;
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("muscle");
    next.delete("skill");
    setSearchParams(next);
  };

  return (
    <Box className="member-library">
      <header className="member-library-header">
        <div>
          <Typography component="p" className="member-library-eyebrow">TRAINING RESOURCES</Typography>
          <Typography component="h1" className="member-library-title">Library</Typography>
          <Typography className="member-library-description">
            Explore exercises, skills and workouts shared with the CalisHealth community.
          </Typography>
        </div>
        <div className="member-library-total" aria-live="polite">
          <span>{entries.length}</span>
          <small>{tab === "exercises" ? "exercises" : "workouts"}</small>
        </div>
      </header>

      <Tabs
        className="member-library-tabs"
        value={tab}
        onChange={(_, value) => {
          const next = new URLSearchParams(searchParams);
          next.delete("tab");
          if (value === "workouts") next.set("tab", "community");
          setSearchParams(next);
        }}
        aria-label="Library content type"
      >
        <Tab value="exercises" icon={<FitnessCenterRoundedIcon />} iconPosition="start" label="Exercises & skills" />
        <Tab value="workouts" icon={<MenuBookRoundedIcon />} iconPosition="start" label="Workouts" />
      </Tabs>

      <div className="member-library-tools">
        <TextField
          fullWidth
          size="small"
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          inputProps={{ "aria-label": `Search ${tab}` }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
        />
        {(muscleFilter || skillFilter) && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={muscleFilter ? `Muscle: ${titleCase(muscleFilter)}` : `Skill: ${titleCase(skillFilter)}`} onDelete={clearFilters} />
            <Button size="small" onClick={clearFilters}>Clear filter</Button>
          </Stack>
        )}
      </div>

      {error && <Alert severity="error">Library content could not be loaded. Please try again later.</Alert>}
      {isLoading ? (
        <div className="member-library-state"><CircularProgress size={28} aria-label="Loading library" /></div>
      ) : !error && entries.length === 0 ? (
        <div className="member-library-state">
          <Typography variant="h6">No content found</Typography>
          <Typography color="text.secondary">Try another search or clear the selected filter.</Typography>
          {(muscleFilter || skillFilter) && <Button onClick={clearFilters}>Clear filter</Button>}
        </div>
      ) : (
        <div className="member-library-grid">
          {entries.map((entry) => (
            <Card className="member-library-card" key={entry.code || entry.name} component="article" variant="outlined">
              <CardContent>
                <div className="member-library-card-top">
                  <Typography component="h2" className="member-library-card-title">{entry.name}</Typography>
                  <Chip size="small" label={tab === "exercises" ? titleCase(entry.type || "Exercise") : titleCase(entry.level || "Workout")} />
                </div>
                <Typography className="member-library-card-description">
                  {entry.description || entry.content || "A CalisHealth training resource."}
                </Typography>
                <div className="member-library-meta">
                  {entry.muscleGroup && <span>{entry.muscleGroup}</span>}
                  {entry.level && tab === "exercises" && <span>{entry.level}</span>}
                  {Array.isArray(entry.exercises) && <span>{entry.exercises.length} exercises</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Box>
  );
}
