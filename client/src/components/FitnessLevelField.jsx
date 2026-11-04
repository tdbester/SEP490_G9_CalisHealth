import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { CM } from "../theme-content";
import { TONE_STYLES } from "./ContentShared";
import { FieldLabel } from "./ProfileSections";
import { buildLevelToneMap } from "../useLevelNames";

/**
 * Fitness level picker of the Profile screen.
 *
 * The closed control shows the level the member is on right now (with its rank on the ladder). The menu
 * lists every level configured in Level & Benchmark Criteria, ordered by score range, so the member can
 * see how far the ladder goes. Picking another level does not change anything yet: it opens a warning
 * that spells out what the switch does to exercise difficulty and to the daily training plan, and only
 * the confirm button inside that warning arms the change for the next save.
 */
export default function FitnessLevelField({ value, options = [], currentLevel, disabled, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const [pending, setPending] = useState(null);

  const toneMap = useMemo(() => buildLevelToneMap(options), [options]);
  const toneOf = (name) => TONE_STYLES[toneMap.get(String(name || "").trim().toLowerCase())] ?? TONE_STYLES.neutral;

  const rankOf = (name) => {
    const index = options.findIndex((option) => option === name);
    return index < 0 ? null : index + 1;
  };

  const currentRank = rankOf(currentLevel);
  const currentTone = toneOf(currentLevel);
  const currentChanges = Boolean(currentLevel) && value !== currentLevel;
  const pendingRank = pending ? rankOf(pending) : null;
  // Positive means the member is moving up the ladder, negative down.
  const direction =
    currentRank && pendingRank ? pendingRank - currentRank : 0;

  const choose = (level) => {
    setAnchor(null);
    if (level === currentLevel) {
      // Back to the level the account is already on: nothing to warn about.
      onChange?.(level);
      return;
    }
    if (level !== value) setPending(level);
  };

  const confirm = () => {
    onChange?.(pending);
    setPending(null);
  };

  return (
    <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
      <FieldLabel>Fitness level</FieldLabel>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
          p: 1.75,
          borderRadius: "12px",
          border: `1px solid ${currentChanges ? "rgba(248,200,88,0.42)" : CM.border}`,
          backgroundColor: "rgba(12,8,27,0.42)",
          transition: "border-color .16s ease, background-color .16s ease",
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            color: currentTone.color,
            bgcolor: currentTone.bg,
            border: `1px solid ${currentTone.border}`,
          }}
        >
          <TrendingUpRoundedIcon sx={{ fontSize: 19 }} />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700 }} noWrap>
            {currentLevel || "Not assessed yet"}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: CM.textMuted }}>
            {currentRank
              ? `Level ${currentRank} of ${options.length} on the CalisHealth ladder`
              : "Complete the onboarding level test to be placed on the ladder"}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          disabled={disabled}
          onClick={(event) => setAnchor(event.currentTarget)}
          endIcon={<ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />}
          aria-haspopup="listbox"
          aria-label="Change fitness level"
          sx={{ flexShrink: 0 }}
        >
          {currentChanges ? `Change to ${value}` : "Change level"}
        </Button>
      </Box>

      <Typography sx={{ display: "block", mt: 0.75, fontSize: 11.5, lineHeight: 1.45, color: CM.textDim }}>
        {disabled
          ? "Fitness level is available for members."
          : "Your daily training plan and recommended exercises follow this level."}
      </Typography>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        MenuListProps={{ "aria-label": "System fitness levels", dense: true }}
        slotProps={{ paper: { sx: { minWidth: 300, mt: 0.75 } } }}
      >
        <Box sx={{ px: 1.75, pt: 0.75, pb: 1 }}>
          <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}>
            Levels in the system
          </Typography>
        </Box>
        {options.map((level, index) => {
          const tone = toneOf(level);
          const isCurrent = level === currentLevel;
          const isPicked = level === value && !isCurrent;
          return (
            <MenuItem
              key={level}
              selected={isCurrent}
              onClick={() => choose(level)}
              sx={{ gap: 1.25, py: 1 }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: tone.color,
                  bgcolor: tone.bg,
                  border: `1px solid ${tone.border}`,
                }}
              >
                {index + 1}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ color: isCurrent ? "#fff" : CM.textMuted, fontWeight: isCurrent ? 700 : 500 }}>
                  {level}
                </Typography>
                {isCurrent && (
                  <Typography variant="caption" sx={{ color: CM.textDim }}>
                    Your current level
                  </Typography>
                )}
              </Box>
              {isCurrent && <CheckRoundedIcon sx={{ fontSize: 16, color: tone.color }} />}
              {isPicked && (
                <Typography variant="caption" sx={{ color: CM.amber, fontWeight: 700 }}>
                  Selected
                </Typography>
              )}
            </MenuItem>
          );
        })}
      </Menu>

      <Dialog open={Boolean(pending)} onClose={() => setPending(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              color: CM.amber,
              bgcolor: "rgba(248,200,88,0.14)",
              border: "1px solid rgba(248,200,88,0.34)",
            }}
          >
            <ReportProblemOutlinedIcon sx={{ fontSize: 18 }} />
          </Box>
          Change fitness level?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: CM.textMuted }}>
            You are switching from{" "}
            <Box component="span" sx={{ color: "#fff", fontWeight: 700 }}>
              {currentLevel || "no level"}
            </Box>{" "}
            to{" "}
            <Box component="span" sx={{ color: "#fff", fontWeight: 700 }}>
              {pending}
            </Box>
            .
          </Typography>

          <Stack spacing={1.25} sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", gap: 1.25 }}>
              <Box sx={{ color: direction < 0 ? CM.green : CM.violetBright, flexShrink: 0, mt: 0.25 }}>
                {direction < 0 ? (
                  <TrendingDownRoundedIcon sx={{ fontSize: 18 }} />
                ) : (
                  <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />
                )}
              </Box>
              <Typography variant="body2" sx={{ color: CM.textMuted }}>
                <Box component="span" sx={{ color: "#fff", fontWeight: 600 }}>
                  Exercise difficulty.{" "}
                </Box>
                The exercises offered to you will be the ones rated{" "}
                <Box component="span" sx={{ color: "#fff", fontWeight: 600 }}>
                  {pending}
                </Box>
                , so they become {direction < 0 ? "easier" : "harder"} than your current set.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 1.25 }}>
              <Box sx={{ color: CM.violetBright, flexShrink: 0, mt: 0.25 }}>
                <ReportProblemOutlinedIcon sx={{ fontSize: 18 }} />
              </Box>
              <Typography variant="body2" sx={{ color: CM.textMuted }}>
                <Box component="span" sx={{ color: "#fff", fontWeight: 600 }}>
                  Daily training plan.{" "}
                </Box>
                A daily training plan belongs to a single level, so today and the following days will
                follow the {pending} plan with its own workouts and targets instead of your current one.
                Only sessions you have already completed keep their original result.
              </Typography>
            </Box>
          </Stack>

          <Typography variant="caption" sx={{ display: "block", mt: 2, color: CM.textDim }}>
            Nothing changes until you press “Save changes” on this page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button size="small" onClick={() => setPending(null)} sx={{ color: CM.textMuted }}>
            Keep {currentLevel || "current level"}
          </Button>
          <Button size="small" variant="contained" onClick={confirm}>
            Switch to {pending}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
