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
  alpha,
  useTheme,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import GavelIcon from "@mui/icons-material/Gavel";
import DescriptionIcon from "@mui/icons-material/Description";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { formatDate } from "../../utils/helpers";
import { normalizeConfidence } from "../../utils/confidence";

export default function ClaimCard({ claim, onClick }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (claim?.claim_text) {
      navigator.clipboard.writeText(claim.claim_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const claimText = claim?.claim_text || "Claim text unavailable";

  const confidence = normalizeConfidence(claim?.confidence_score);

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
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              display: "flex",
              alignItems: "center",
            }}
          >
            <GavelIcon color="primary" fontSize="small" />
          </Box>
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, lineHeight: 1.4, flex: 1, wordBreak: "break-word" }}
                title={claimText}
              >
                {claimText}
              </Typography>
              {claim?.claim_text && (
                <Tooltip title={copied ? "Copied" : "Copy claim"}>
                  <IconButton size="small" onClick={handleCopy}>
                    {copied ? <CheckCircleIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              {claim?.claim_type && (
                <Chip
                  size="small"
                  label={claim.claim_type}
                  color="primary"
                  variant="outlined"
                  icon={<DescriptionIcon fontSize="small" />}
                />
              )}
              {claim?.confidence_score && (
                <Chip
                  size="small"
                  label={`${confidence.percent} (${confidence.level})`}
                  color={confidence.chipColor}
                  sx={{ color: "white", "& .MuiChip-label": { color: "white" } }}
                />
              )}
              {claim?.claim_number != null && <Chip size="small" label={`#${claim.claim_number}`} />}
            </Stack>
          </Stack>
        </Stack>

        {(claim?.section || claim?.context) && (
          <>
            <Divider />
            <Stack spacing={1}>
              {claim?.section && (
                <Typography variant="body2" color="text.secondary">
                  Section: {claim.section}
                </Typography>
              )}
              {claim?.context && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                  title={claim.context}
                >
                  {claim.context}
                </Typography>
              )}
            </Stack>
          </>
        )}

        {claim?.created_at && (
          <>
            <Divider />
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <CalendarTodayIcon fontSize="inherit" sx={{ opacity: 0.7 }} />
              {formatDate(claim.created_at)}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}

