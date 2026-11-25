import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import api from "../../api/client";
import {
  FORM_RULE_JOINTS,
  MOVEMENT_GROUPS,
  emptyRule,
  normalizeRules,
  denormalizeRules,
  suggestionsToRules,
} from "./formRuleUtils";
import FormRuleFieldHelp from "./FormRuleFieldHelp";

export { FORM_RULE_JOINTS, MOVEMENT_GROUPS, emptyRule, normalizeRules, denormalizeRules };

/**
 * Bảng khai báo ngưỡng chấm form cho một bài tập.
 *
 * Dùng chung cho Content Manager (trong form tạo/sửa bài) và Member (trong form
 * tạo bài custom). Member có thêm nút "Gợi ý" để lấy trung bình ngưỡng của
 * các bài cùng nhóm chuyển động.
 *
 * Công thức chấm của bài đếm lần (REPS) và bài giữ tư thế (HOLD) khác nhau,
 * nên các ô nhập góc hiển thị theo `category`:
 *   - REPS: góc trên + góc đáy (mỗi lần rep có điểm đáy/điểm trên).
 *   - HOLD: góc nhỏ nhất + góc lớn nhất (dải góc của tư thế đang giữ).
 * Chuyển loại bài chỉ ẩn/hiện ô, không xoá giá trị đã nhập.
 *
 * @param {object} props
 * @param {Array} props.rules - danh sách rule hiện tại
 * @param {Function} props.onChange - callback nhận danh sách rule mới
 * @param {string} props.movementGroup - nhóm chuyển động (PUSH | PULL | LEGS | CORE)
 * @param {string} props.category - loại bài (REPS | HOLD)
 * @param {boolean} props.showSuggestion - bật nút gợi ý (dành cho Member)
 */
export default function FormRuleEditor({
  rules,
  onChange,
  movementGroup,
  category,
  showSuggestion = false,
}) {
  const { t } = useTranslation();
  const [suggesting, setSuggesting] = useState(false);
  const list = Array.isArray(rules) ? rules : [];

  /** Bài giữ tư thế dùng dải góc min/max, bài đếm lần dùng góc trên/đáy. */
  const isHold = category === "HOLD";

  const update = (index, patch) => {
    onChange(list.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  const add = () => onChange([...list, emptyRule()]);

  const remove = (index) => onChange(list.filter((_, i) => i !== index));

  /**
   * Lấy gợi ý ngưỡng từ server (trung bình các bài cùng nhóm chuyển động).
   */
  const loadSuggestion = async () => {
    if (!movementGroup) return;
    setSuggesting(true);
    try {
      const { data } = await api.get("/member/form-rules/suggestions", {
        params: { movementGroup, category: category || undefined },
      });
      const suggested = suggestionsToRules(data?.suggestions || []);
      if (suggested.length) {
        onChange(suggested);
      }
    } catch {
      // Không lấy được gợi ý -> member vẫn tự nhập được.
    } finally {
      setSuggesting(false);
    }
  };

  /**
   * Nhãn ô nhập kèm dấu hỏi giải thích.
   *
   * MUI v6 ghi đè `InputLabelProps.children` bằng prop `label`, nên phải gắn
   * icon trực tiếp vào `label` (node) thay vì `InputLabelProps`.
   */
  const labelWithHelp = (field, text) => (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <span>{text}</span>
      <FormRuleFieldHelp field={field} scope="cm" />
    </span>
  );

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {t("contentManager.form.formRules.editorTitle")}
        </Typography>
        {showSuggestion && (
          <Button
            size="small"
            startIcon={<AutoAwesomeIcon fontSize="small" />}
            onClick={loadSuggestion}
            disabled={suggesting || !movementGroup}
          >
            {suggesting
              ? t("contentManager.form.formRules.suggestLoading")
              : t("contentManager.form.formRules.suggest")}
          </Button>
        )}
        <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={add}>
          {t("contentManager.form.formRules.addRule")}
        </Button>
      </Stack>

      <Typography
        variant="caption"
        sx={{ display: "block", mb: 1.5, color: "text.secondary" }}
      >
        {isHold
          ? t("formRuleHelp.categoryNoticeHold")
          : t("formRuleHelp.categoryNoticeReps")}
      </Typography>

      {list.map((rule, index) => (
        <Stack key={index} spacing={1} sx={{ mb: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label={labelWithHelp(
                "joint",
                t("contentManager.form.formRules.joint")
              )}
              value={rule.joint}
              onChange={(event) => update(index, { joint: event.target.value })}
              sx={{ minWidth: 140 }}
            >
              {FORM_RULE_JOINTS.map((joint) => (
                <MenuItem key={joint} value={joint}>
                  {t(`contentManager.form.formRules.jointOption.${joint}`)}
                </MenuItem>
              ))}
            </TextField>
            <IconButton
              size="small"
              onClick={() => remove(index)}
              aria-label={t("contentManager.form.formRules.removeRuleAria")}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>

          {isHold ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                label={labelWithHelp(
                  "minAngle",
                  t("contentManager.form.formRules.minAngle")
                )}
                value={rule.minAngle}
                onChange={(event) => update(index, { minAngle: event.target.value })}
              />
              <TextField
                size="small"
                fullWidth
                label={labelWithHelp(
                  "maxAngle",
                  t("contentManager.form.formRules.maxAngle")
                )}
                value={rule.maxAngle}
                onChange={(event) => update(index, { maxAngle: event.target.value })}
              />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                label={labelWithHelp(
                  "topAngle",
                  t("contentManager.form.formRules.topAngle")
                )}
                value={rule.angleThreshold}
                onChange={(event) => update(index, { angleThreshold: event.target.value })}
              />
              <TextField
                size="small"
                fullWidth
                label={labelWithHelp(
                  "bottomAngle",
                  t("contentManager.form.formRules.bottomAngle")
                )}
                value={rule.romDepth}
                onChange={(event) => update(index, { romDepth: event.target.value })}
              />
            </Stack>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              fullWidth
              label={labelWithHelp(
                "weight",
                t("contentManager.form.formRules.weight")
              )}
              value={rule.weight}
              onChange={(event) => update(index, { weight: event.target.value })}
            />
            <TextField
              size="small"
              fullWidth
              label={labelWithHelp(
                "tolerance",
                t("contentManager.form.formRules.tolerance")
              )}
              value={rule.tolerance}
              onChange={(event) => update(index, { tolerance: event.target.value })}
            />
          </Stack>
        </Stack>
      ))}

      {list.length === 0 && (
        <Chip
          label={t("contentManager.form.formRules.noRulesYet")}
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );
}
