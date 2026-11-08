import { Box, Button, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CONTENT_PATHS, ContentPageHeader } from "../components/ContentShared";

const SECTION_DETAILS = {
  surveys: {
    titleKey: "contentManager.sections.surveys.title",
    descriptionKey: "contentManager.sections.surveys.description",
  },
  progressionRules: {
    titleKey: "contentManager.sections.progressionRules.title",
    descriptionKey: "contentManager.sections.progressionRules.description",
  },
  levelCriteria: {
    titleKey: "contentManager.sections.levelCriteria.title",
    descriptionKey: "contentManager.sections.levelCriteria.description",
  },
};

export default function ContentManagerSectionPage({ section }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const details = SECTION_DETAILS[section];

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={[
          { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
          { label: t(details.titleKey) },
        ]}
        title={t(details.titleKey)}
        description={t(details.descriptionKey)}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {t("common.common.notAvailableYet")}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate(CONTENT_PATHS.dashboard)}
        sx={{ mt: 2 }}
      >
        {t("common.common.backToDashboard")}
      </Button>
    </Box>
  );
}
