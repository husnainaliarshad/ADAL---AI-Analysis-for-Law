/**
 * QuickActions Component
 * Displays a set of quick action buttons for common tasks like uploading documents,
 * viewing documents, searching, citation checking, and running OCR
 */
import React from "react";
import { Card, CardContent, Typography, Box, Tooltip, alpha, Button, Alert } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DescriptionIcon from "@mui/icons-material/Description";
import SearchIcon from "@mui/icons-material/Search";
import GavelIcon from "@mui/icons-material/Gavel";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../utils/constants";
import { useTheme } from "@mui/material/styles";

export default function QuickActions() {
  const navigate = useNavigate();
  const theme = useTheme();
  const accentMain = theme.palette.primary.main;
  const accentStrong = theme.palette.primary.dark || theme.palette.primary.main;
  const [notAvailableMessage, setNotAvailableMessage] = React.useState("");

  const showNotAvailable = (label) => {
    setNotAvailableMessage(`${label} is not available yet.`);
  };

  const actions = [
    {
      icon: <UploadFileIcon />,
      label: "Upload New Document",
      copy: "Add a new file and move it into OCR or review.",
      variant: "contained",
      action: () => navigate(ROUTES.DOCUMENT_UPLOAD),
    },
    {
      icon: <DescriptionIcon />,
      label: "View All Documents",
      copy: "Open the document library and review existing files.",
      variant: "outlined",
      action: () => navigate(ROUTES.DOCUMENTS),
    },
    {
      icon: <SearchIcon />,
      label: "Start New Search",
      copy: "Research and search tools will live here once enabled.",
      variant: "outlined",
      action: () => showNotAvailable("Search"),
      disabled: true,
    },
    {
      icon: <GavelIcon />,
      label: "Citation Checker",
      copy: "Jump into documents and inspect extracted citations.",
      variant: "outlined",
      action: () => {
        // Navigate to documents page where users can select a document to view citations
        navigate(ROUTES.DOCUMENTS);
      },
    },
    {
      icon: <TextSnippetIcon />,
      label: "Run OCR on PDF",
      copy: "OCR shortcuts can be surfaced here once the flow is ready.",
      variant: "outlined",
      action: () => showNotAvailable("Run OCR shortcut"),
      disabled: true,
    },
  ];

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.12)}`,
        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.06)}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 24%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${alpha(accentMain, 0.9)} 38%, transparent 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: 3, position: "relative", zIndex: 1 }}>
        <Box sx={{ display: "grid", gap: 0.35, mb: 2.4 }}>
          <Typography
            sx={{
              fontSize: "0.68rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "text.secondary",
              fontWeight: 600,
            }}
          >
            Workspace Actions
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: "1.15rem", md: "1.3rem" },
              color: "text.primary",
            }}
          >
            Move quickly between the main document workflows.
          </Typography>
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: "0.84rem",
              lineHeight: 1.65,
              maxWidth: "72ch",
            }}
          >
            Keep the most common workspace actions visible here, and push secondary tooling deeper into the product.
          </Typography>
        </Box>
        {notAvailableMessage && (
          <Alert
            severity="info"
            sx={{
              mb: 2,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              color: "text.primary",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
            }}
            onClose={() => setNotAvailableMessage("")}
          >
            {notAvailableMessage}
          </Alert>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {actions.map((action, index) => (
            <Box key={index}>
              <Tooltip title={action.label} arrow placement="top">
                <span>
                  <Button
                    onClick={action.action}
                    variant={action.variant}
                    disabled={Boolean(action.disabled)}
                    sx={{
                      width: "100%",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 1.2,
                      px: 1.6,
                      py: 1.35,
                      borderRadius: 2.5,
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      textTransform: "none",
                      textAlign: "left",
                      ...(action.variant === "contained"
                        ? {
                            bgcolor: accentMain,
                            color: "common.white",
                            boxShadow: `0 10px 22px ${alpha(accentMain, 0.24)}`,
                            "&:hover": {
                              bgcolor: accentStrong,
                              boxShadow: `0 12px 24px ${alpha(accentMain, 0.28)}`,
                            },
                          }
                        : {
                            border: `1px solid ${alpha(accentMain, 0.24)}`,
                            color: "text.primary",
                            bgcolor: alpha(accentMain, 0.04),
                            "&:hover": {
                              bgcolor: alpha(accentMain, 0.09),
                              borderColor: alpha(accentStrong, 0.32),
                            },
                          }),
                      transition: "all 0.3s ease",
                    }}
                    aria-label={action.label}
                  >
                    <Box sx={{ display: "flex", gap: 1.1, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 1.75,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          bgcolor: action.variant === "contained"
                            ? alpha(theme.palette.common.white, 0.16)
                            : alpha(accentMain, 0.1),
                          border: `1px solid ${
                            action.variant === "contained"
                              ? alpha(theme.palette.common.white, 0.18)
                              : alpha(accentMain, 0.16)
                          }`,
                          "& svg": {
                            fontSize: 20,
                            color: action.variant === "contained" ? theme.palette.common.white : accentMain,
                          },
                        }}
                      >
                        {action.icon}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: "0.84rem",
                            fontWeight: 700,
                            color: "inherit",
                            lineHeight: 1.35,
                          }}
                        >
                          {action.label}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.45,
                            fontSize: "0.74rem",
                            lineHeight: 1.55,
                            color: action.variant === "contained"
                              ? alpha(theme.palette.common.white, 0.86)
                              : "text.secondary",
                          }}
                        >
                          {action.copy}
                        </Typography>
                      </Box>
                    </Box>
                    <ArrowOutwardIcon
                      sx={{
                        fontSize: 16,
                        mt: 0.25,
                        opacity: action.disabled ? 0.4 : 0.8,
                        flexShrink: 0,
                      }}
                    />
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
