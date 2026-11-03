import { Box, Card, Divider, Stack, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { CM } from "../theme-content";

export const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

/**
 * Card with an icon, a title, a muted subtitle and optional right-hand content.
 *
 * The card is lit from the top edge (a violet wash that fades out before the first field) so the
 * three stacked sections read as separate surfaces instead of one long dark column.
 */
export function SectionCard({ icon, title, description, aside, children, delay = 0, className, sx }) {
  return (
    <Card
      className={className}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "18px",
        p: { xs: 2.5, sm: 3 },
        border: `1px solid ${CM.border}`,
        background: `linear-gradient(180deg, rgba(139,92,246,0.13) 0%, rgba(30,18,64,0) 132px), ${CM.surface}`,
        ...enter(delay),
        ...sx,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          {icon && (
            <Box
              sx={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: "11px",
                display: "grid",
                placeItems: "center",
                color: CM.violetBright,
                bgcolor: "rgba(139,92,246,0.16)",
                border: "1px solid rgba(167,139,250,0.30)",
                "& svg": { fontSize: 18 },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{ color: "#fff", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 }}
            >
              {title}
            </Typography>
            {description && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.25, color: CM.textMuted, fontSize: 12 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Stack>
        {aside}
      </Stack>
      <Divider sx={{ my: 2.5, borderColor: CM.border }} />
      {children}
    </Card>
  );
}

/** Small tracked label above every field; shared so read-only and editable rows line up exactly. */
export function FieldLabel({ children }) {
  return (
    <Typography
      component="span"
      sx={{
        display: "block",
        mb: 0.75,
        color: CM.textMuted,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </Typography>
  );
}

/** Read-only account fact such as the email address or the join date. */
export function ReadOnlyField({ label, value, hint, adornment }) {
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          minHeight: 44,
          px: 1.75,
          py: 1,
          borderRadius: "12px",
          border: `1px solid ${CM.border}`,
          backgroundColor: "rgba(12,8,27,0.42)",
          transition: "border-color .16s ease, background-color .16s ease",
          "&:hover": {
            borderColor: "rgba(167,139,250,0.30)",
            backgroundColor: "rgba(12,8,27,0.55)",
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: CM.text, fontWeight: 500, minWidth: 0, overflowWrap: "anywhere" }}
        >
          {value || "—"}
        </Typography>
        {adornment}
      </Stack>
      {hint && (
        <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: CM.textDim }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

/** Small rounded label used in the card headers (role, status, password state). */
export function StatePill({ tone = "primary", icon, label }) {
  const TONES = {
    primary: { color: "#C4B5FD", bg: "rgba(139,92,246,0.18)", border: "rgba(167,139,250,0.38)" },
    success: { color: "#86EFAC", bg: "rgba(120,232,136,0.14)", border: "rgba(120,232,136,0.34)" },
    warning: { color: "#FCD34D", bg: "rgba(248,200,88,0.14)", border: "rgba(248,200,88,0.34)" },
  };
  const c = TONES[tone] ?? TONES.primary;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        height: 25,
        px: 1.25,
        borderRadius: "999px",
        fontSize: 11,
        fontWeight: 600,
        color: c.color,
        bgcolor: c.bg,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
        "& svg": { fontSize: 13 },
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/** Grid used by both the read-only and the editable field groups. */
export const FIELD_GRID = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
};
