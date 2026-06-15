/**
 * RecentOCR Component
 * Displays a list of recent documents that have been processed with OCR
 * 
 * @param {Array} rows - Array of OCR result objects with id, name, accuracy, language
 */
import React from "react";
import { Box, Card, CardContent, Divider, List, ListItem, ListItemText, Typography, alpha, useTheme, Link, Chip } from "@mui/material";
import AtlasButton from "../../../components/common/AtlasButton";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../utils/constants";

export default function RecentOCR({ rows = [] }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const accentMain = theme.palette.primary.main;
  const accentStrong = theme.palette.primary.dark || theme.palette.primary.main;

  const handleViewAll = () => {
    navigate(ROUTES.DOCUMENTS);
  };

  const handleViewDocument = (documentId) => {
    navigate(`${ROUTES.DOCUMENTS}/${documentId}`);
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.12)}`,
        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.06)}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 22%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        display: "flex",
        flexDirection: "column",
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
      <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Box sx={{ display: "grid", gap: 0.25 }}>
            <Typography
              sx={{
                fontSize: "0.68rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "text.secondary",
                fontWeight: 600,
              }}
            >
              OCR
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.1rem", md: "1.25rem" },
              }}
            >
              Recent OCR Results
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.8rem",
                lineHeight: 1.6,
              }}
            >
              Recently processed records that are ready for downstream legal work.
            </Typography>
          </Box>
          <Link
            component="button"
            onClick={handleViewAll}
            sx={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: accentMain,
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": {
                textDecoration: "underline",
                color: accentStrong,
              },
            }}
          >
            View All
          </Link>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {(!rows || rows.length === 0) ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
              textAlign: "center",
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No OCR results yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Process documents to see OCR results here
            </Typography>
          </Box>
        ) : (
          <List sx={{ flex: 1, p: 0 }}>
            {rows && rows.map((o, index) => (
              <ListItem
                key={o.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1.5,
                  px: 0,
                  borderBottom: index < rows.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : "none",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: alpha(accentMain, 0.05),
                    borderRadius: 1,
                    px: 1,
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        mb: 0.5,
                        maxWidth: { xs: 150, sm: 200 },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.name}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      {o.accuracy !== null && (
                        <Chip
                          label={`${o.accuracy}% accuracy`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            bgcolor: alpha(accentMain, 0.12),
                            color: accentMain,
                            fontWeight: 600,
                          }}
                        />
                      )}
                      {o.language !== null && (
                        <Chip
                          label={o.language}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            bgcolor: alpha(accentMain, 0.08),
                            color: accentStrong,
                            fontWeight: 600,
                          }}
                        />
                      )}
                      {o.accuracy === null && o.language === null && (
                        <Typography variant="caption" color="text.secondary">
                          OCR processed
                        </Typography>
                      )}
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  sx={{ mr: 2, flex: 1 }}
                />
                <Box sx={{ flex: "0 0 auto" }}>
                  <AtlasButton
                    size="small"
                    variant="outlined"
                    onClick={() => handleViewDocument(o.id)}
                    sx={{
                      minWidth: "auto",
                      px: 2,
                      fontSize: "0.75rem",
                    }}
                  >
                    View
                  </AtlasButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
