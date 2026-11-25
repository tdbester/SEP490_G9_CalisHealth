import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

/**
 * Dấu hỏi giải thích cho một field của phần chấm form.
 *
 * Hiển thị 2 lớp giúp người tạo hiểu field này dùng để làm gì:
 *  - Hover: tooltip ngắn (giải thích 1 câu).
 *  - Click: hộp thoại chi tiết kèm ví dụ số thực tế.
 *
 * Icon được render bằng `<span>` (không phải `IconButton`) vì nó nằm ngay
 * trong `<label>` của TextField — tránh lồng phần tử tương tác vào trong
 * label để tránh lỗi accessibility và tránh focus nhảy về ô nhập khi bấm.
 *
 * @param {object} props
 * @param {string} props.field - tên field trong namespace `formRuleHelp.fields`
 *   (joint | topAngle | bottomAngle | minAngle | maxAngle | weight | tolerance).
 * @param {string} [props.scope] - "cm" (Content Manager) | "member".
 */
export default function FormRuleFieldHelp({ field, scope = "cm" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const accent = scope === "member" ? "#c084fc" : "#8b5cf6";
  const label = t(`formRuleHelp.fields.${field}.label`);
  const titleId = `form-rule-help-${field}`;

  const openHelp = (event) => {
    // Chặn hành vi mặc định của <label> (focus về ô nhập) khi bấm dấu hỏi.
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <Tooltip title={t(`formRuleHelp.fields.${field}.help`)} arrow>
        <span
          role="button"
          tabIndex={0}
          onClick={openHelp}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          aria-label={label}
          aria-haspopup="dialog"
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginLeft: 4,
            color: "rgba(255,255,255,0.45)",
            cursor: "help",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = accent;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = "rgba(255,255,255,0.45)";
          }}
        >
          <HelpOutlineRoundedIcon sx={{ fontSize: 16 }} />
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
        PaperProps={{
          sx: {
            bgcolor: "#17102f",
            backgroundImage: "none",
            border: `1px solid ${accent}55`,
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          id={titleId}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            pb: 1,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <HelpOutlineRoundedIcon sx={{ color: accent, fontSize: 20 }} />
            <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>
              {label}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="close">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ color: "rgba(255,255,255,0.78)", pt: "8px !important" }}>
          <Typography variant="body2" sx={{ lineHeight: 1.65 }}>
            {t(`formRuleHelp.fields.${field}.help`)}
          </Typography>

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              bgcolor: "rgba(139,92,246,0.10)",
              border: `1px solid ${accent}33`,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mb: 0.5,
                fontWeight: 700,
                color: accent,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {t("formRuleHelp.exampleLabel")}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
              {t(`formRuleHelp.fields.${field}.example`)}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
