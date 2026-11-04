import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import VideocamOffOutlinedIcon from "@mui/icons-material/VideocamOffOutlined";
import { CM } from "../../theme-content";

/**
 * <video> / <img> that shows a placeholder when the file cannot be loaded,
 * e.g. it was removed from Cloudinary but the exercise still links to it.
 */
export default function MediaWithFallback({ kind = "image", src, alt, sx }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    const Icon = kind === "video" ? VideocamOffOutlinedIcon : BrokenImageOutlinedIcon;
    return (
      <Box
        role="img"
        aria-label={alt}
        sx={{
          ...sx,
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          bgcolor: CM.surfaceSoft,
          border: `1px dashed ${CM.border}`,
          color: CM.textMuted,
        }}
      >
        <Icon sx={{ fontSize: 36 }} />
        <Typography variant="body2" sx={{ color: CM.textMuted }}>
          {kind === "video" ? "This video is no longer available." : "This image is no longer available."}
        </Typography>
      </Box>
    );
  }

  return kind === "video" ? (
    <Box component="video" src={src} controls aria-label={alt} onError={() => setFailed(true)} sx={sx} />
  ) : (
    <Box component="img" src={src} alt={alt} onError={() => setFailed(true)} sx={sx} />
  );
}
