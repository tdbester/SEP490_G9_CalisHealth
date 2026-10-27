import { Box, Button, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { CONTENT_PATHS, ContentPageHeader } from "../components/ContentShared";

const SECTION_DETAILS = {
  surveys: {
    title: "Survey Management",
    description: "Manage survey questions and answer options.",
  },
  progressionRules: {
    title: "Progression Rules",
    description: "Manage progression rules for member training milestones.",
  },
  levelCriteria: {
    title: "Level Criteria",
    description: "Manage requirements for each training level.",
  },
};

export default function ContentManagerSectionPage({ section }) {
  const navigate = useNavigate();
  const details = SECTION_DETAILS[section];

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={[
          { label: "Content manager", to: CONTENT_PATHS.dashboard },
          { label: details.title },
        ]}
        title={details.title}
        description={details.description}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        This management section is not available yet.
      </Typography>
      <Button
        variant="outlined"
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate(CONTENT_PATHS.dashboard)}
        sx={{ mt: 2 }}
      >
        Back to dashboard
      </Button>
    </Box>
  );
}
