import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Box,
  Divider,
  Tooltip,
  IconButton,
  useTheme,
  alpha,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DescriptionIcon from "@mui/icons-material/Description";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { formatDate } from "../../utils/helpers";

export default function CitationCard({ citation, onClick }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const getCitationTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case "case":
        return "primary";
      case "statute":
        return "secondary";
      case "regulation":
        return "info";
      default:
        return "default";
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence?.toLowerCase()) {
      case "high":
        return "success";
      case "medium":
        return "warning";
      case "low":
        return "error";
      default:
        return "default";
    }
  };

  const handleCopyCitation = (e) => {
    e.stopPropagation(); // Prevent card click when copying
    if (citation.citation_text) {
      navigator.clipboard.writeText(citation.citation_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onClick) onClick();
    }
  };

  const citationText = citation.citation_text || "Citation";
  const hasMetadata =
    citation.year ||
    citation.court ||
    citation.reporter ||
    citation.page ||
    citation.jurisdiction;

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        "&:hover": onClick
          ? {
              boxShadow: 6,
              transform: "translateY(-4px)",
              borderColor: theme.palette.primary.main,
            }
          : {},
        "&:focus-visible": onClick
          ? {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
            }
          : {},
      }}
      onClick={onClick}
      onKeyPress={handleKeyPress}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? "button" : "article"}
      aria-label={onClick ? `View citation: ${citationText}` : `Citation: ${citationText}`}
    >
      <CardContent sx={{ p: 2.5, flex: 1, display: "flex", flexDirection: "column" }}>
        <Stack spacing={2} sx={{ flex: 1 }}>
          {/* Header with Citation Text */}
          <Box>
            <Stack
              direction="row"
              alignItems="flex-start"
              spacing={1}
              sx={{ mb: 1.5 }}
            >
              <Box
                sx={{
                  p: 0.75,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: "flex",
                  alignItems: "center",
                  mt: 0.25,
                }}
              >
                <GavelIcon color="primary" fontSize="small" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 0.5 }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      flex: 1,
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                    title={citationText}
                  >
                    {citationText}
                  </Typography>
                  {citation.citation_text && (
                    <Tooltip title={copied ? "Copied!" : "Copy citation"}>
                      <IconButton
                        size="small"
                        onClick={handleCopyCitation}
                        sx={{
                          opacity: 0.7,
                          "&:hover": { opacity: 1 },
                          transition: "opacity 0.2s",
                        }}
                        aria-label="Copy citation text"
                      >
                        {copied ? (
                          <CheckCircleIcon fontSize="small" color="success" />
                        ) : (
                          <ContentCopyIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  <Tooltip
                    title={`Citation type: ${citation.citation_type || "Unknown"}`}
                    arrow
                  >
                    <Chip
                      label={citation.citation_type || "Unknown"}
                      size="small"
                      color={getCitationTypeColor(citation.citation_type)}
                      variant="outlined"
                      icon={<GavelIcon fontSize="small" />}
                    />
                  </Tooltip>
                  {citation.confidence_score && (
                    <Tooltip
                      title={`Confidence level: ${citation.confidence_score}`}
                      arrow
                    >
                      <Chip
                        label={`${citation.confidence_score} confidence`}
                        size="small"
                        color={getConfidenceColor(citation.confidence_score)}
                        sx={{ color: "white", "& .MuiChip-label": { color: "white" } }}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Box>

          {hasMetadata && (
            <>
              <Divider />
              {/* Metadata */}
              <Stack spacing={1.5}>
                {citation.year && (
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <CalendarTodayIcon
                      fontSize="small"
                      color="action"
                      sx={{ opacity: 0.7 }}
                    />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Year
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, lineHeight: 1.2 }}
                      >
                        {citation.year}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {citation.court && (
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <LocationOnIcon
                      fontSize="small"
                      color="action"
                      sx={{ opacity: 0.7 }}
                    />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Court
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, lineHeight: 1.2 }}
                      >
                        {citation.court}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {citation.reporter && (
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <DescriptionIcon
                      fontSize="small"
                      color="action"
                      sx={{ opacity: 0.7 }}
                    />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Reporter
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, lineHeight: 1.2 }}
                      >
                        {citation.reporter}
                        {citation.volume && ` Vol. ${citation.volume}`}
                        {citation.page && `, p. ${citation.page}`}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {citation.jurisdiction && !citation.court && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Jurisdiction
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, lineHeight: 1.2 }}
                    >
                      {citation.jurisdiction}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </>
          )}

          {/* Context Preview */}
          {citation.context && (
            <>
              <Divider sx={{ mt: "auto" }} />
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, mb: 0.75, display: "block" }}
                >
                  Context:
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.text.secondary, 0.05),
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      fontStyle: "italic",
                      lineHeight: 1.6,
                    }}
                    title={citation.context}
                  >
                    {citation.context}
                  </Typography>
                </Box>
              </Box>
            </>
          )}

          {/* Footer */}
          {citation.created_at && (
            <>
              <Divider />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <CalendarTodayIcon fontSize="inherit" sx={{ opacity: 0.6 }} />
                Extracted {formatDate(citation.created_at)}
              </Typography>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

