import { useRef, useState } from "react";
import { Avatar, Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import { CM } from "../theme-content";
import { avatarUrl, profileApi } from "../api/profile";
import { enter } from "./ProfileSections";

/** First letters of the first two words, used when the account has no photo. */
export function initialsOf(name) {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  return initials || "CH";
}

export default function ProfileAvatarCard({ profile, onChanged, delay = 0 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = () => inputRef.current?.click();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const updated = await profileApi.uploadAvatar(file);
      onChanged?.(updated, "Your photo has been updated.");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Could not upload the photo. Choose a JPG, PNG or WebP image up to 5 MB.",
      );
    } finally {
      setUploading(false);
    }
  };

  const hasPhoto = Boolean(profile?.avatarUrl);

  return (
    <Box className="profile-photo-hero" sx={enter(delay)}>
      <Stack direction="column" spacing={1.5} alignItems="center" sx={{ textAlign: "center" }}>
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <Box className="profile-avatar-ring" sx={{ p: "5px", borderRadius: "50%", backgroundImage: CM.gradient, display: "inline-flex" }}>
            <Avatar
              src={avatarUrl(profile?.avatarUrl) || undefined}
              alt={profile?.fullName || "Profile photo"}
              sx={{
                width: { xs: 128, sm: 156 },
                height: { xs: 128, sm: 156 },
                bgcolor: "#241748",
                color: CM.textMuted,
                fontSize: { xs: 42, sm: 52 },
                fontWeight: 700,
                border: `2px solid ${CM.surface}`,
              }}
            >
              {initialsOf(profile?.fullName)}
            </Avatar>
          </Box>

          <Tooltip title={hasPhoto ? "Change photo" : "Upload photo"}>
            <span>
              <IconButton
                onClick={pick}
                disabled={uploading}
                aria-label={hasPhoto ? "Change photo" : "Upload photo"}
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 38,
                  height: 38,
                  background: CM.buttonGradient,
                  color: "#fff",
                  border: `2px solid ${CM.surface}`,
                  "&:hover": { background: CM.buttonGradient, color: "#fff" },
                }}
              >
                {uploading ? (
                  <CircularProgress size={18} sx={{ color: "#fff" }} />
                ) : (
                  <PhotoCameraRoundedIcon sx={{ fontSize: 19 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={handleFile}
          />
        </Box>

        <Typography className="profile-name" component="h2">
          {profile?.fullName || "Your profile"}
        </Typography>
        <Stack spacing={1.25} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhotoCameraRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={pick}
              disabled={uploading}
            >
              {hasPhoto ? "Change photo" : "Upload photo"}
            </Button>
          </Stack>
          {error && (
            <Typography variant="caption" role="alert" sx={{ color: CM.pink }}>
              {error}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
