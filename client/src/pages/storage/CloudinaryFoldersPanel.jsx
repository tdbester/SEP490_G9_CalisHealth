import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useTranslation } from "react-i18next";
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import { formatBytes, Panel, Pill } from "./StorageShared";

const headCellSx = { color: CM.textDim, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", whiteSpace: "nowrap" };

/**
 * The folders of the Cloudinary account the app writes into.
 *
 * The folder says what a file is, so the admin can find the media of a type in the Media Library
 * without opening every file. Cloudinary creates a folder by itself when the first file is
 * uploaded, so the button is only needed when the admin wants the structure to be visible right
 * away (or to repair a folder that was deleted by hand).
 */
export default function CloudinaryFoldersPanel() {
  const { t } = useTranslation("storage");
  const { data, isLoading, error, refetch } = useApiQuery(() => adminStorageApi.folders());
  const [settingUp, setSettingUp] = useState(false);
  const [notice, setNotice] = useState(null);

  if (error) return <Alert severity="error">{apiErrorMessage(error, t("folders.errorLoad"))}</Alert>;
  if (isLoading || !data) return <Skeleton variant="rounded" height={220} />;

  const folders = data.folders ?? [];
  const missing = folders.filter((f) => !f.exists).length;

  // Creates the folders that are not in the account yet.
  const runSetup = async () => {
    setSettingUp(true);
    setNotice(null);
    try {
      const result = await adminStorageApi.setupFolders();
      await refetch();
      const created = result.created?.length ?? 0;
      setNotice({
        severity: "success",
        text: created > 0
          ? t("folders.setupDone", { count: created })
          : t("folders.setupNothing"),
      });
    } catch (error) {
      setNotice({ severity: "error", text: apiErrorMessage(error, t("folders.errorSetup")) });
    } finally {
      setSettingUp(false);
    }
  };

  return (
    <Panel
      title={t("folders.title")}
      action={
        <Button
          variant="outlined"
          onClick={runSetup}
          disabled={settingUp}
          startIcon={<CreateNewFolderOutlinedIcon />}
          sx={{ whiteSpace: "nowrap" }}
        >
          {settingUp ? t("folders.settingUp") : t("folders.setup")}
        </Button>
      }
    >
      <Typography sx={{ fontSize: 12.5, color: CM.textMuted, mb: 2 }}>
        {t("folders.hint")}
      </Typography>

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }}>
          {notice.text}
        </Alert>
      )}

      {missing > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("folders.missing", { count: missing })}
        </Alert>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headCellSx}>{t("folders.columnFolder")}</TableCell>
            <TableCell sx={headCellSx}>{t("folders.columnPurpose")}</TableCell>
            <TableCell align="right" sx={headCellSx}>
              {t("folders.columnFiles")}
            </TableCell>
            <TableCell align="right" sx={headCellSx}>
              {t("folders.columnSize")}
            </TableCell>
            <TableCell align="right" sx={headCellSx}>
              {t("folders.columnStatus")}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {folders.map((folder) => (
            <TableRow key={folder.path}>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FolderOutlinedIcon sx={{ fontSize: 17, color: CM.violet }} />
                  <Typography sx={{ fontSize: 13, fontFamily: "monospace" }}>{folder.path}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography sx={{ fontSize: 13 }}>{t(`folders.purpose.${folder.label}`)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontSize: 13 }}>{folder.files.toLocaleString("en-US")}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontSize: 13 }}>{formatBytes(folder.bytes)}</Typography>
              </TableCell>
              <TableCell align="right">
                {folder.exists ? (
                  <Pill tone="green">{t("folders.statusReady")}</Pill>
                ) : (
                  <Pill tone="amber">{t("folders.statusMissing")}</Pill>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" variant="text" onClick={refetch} startIcon={<RefreshRoundedIcon />}>
          {t("folders.refresh")}
        </Button>
      </Box>
    </Panel>
  );
}
