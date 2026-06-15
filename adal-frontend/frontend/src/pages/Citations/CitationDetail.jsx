import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  Alert,
  Button,
  Chip,
  Skeleton,
  Paper,
  Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNavigate, useParams } from "react-router-dom";
import AtlasButton from "../../components/common/AtlasButton";
import { formatDate } from "../../utils/helpers";
import citationApi from "../../api/citationApi";
import logger from "../../utils/logger";
import Sidebar from "../../components/layout/Sidebar";

export default function CitationDetail() {
  const navigate = useNavigate();
  const { citationId } = useParams();
  const [citation, setCitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCitation = async () => {
      if (!citationId) {
        setError("Citation ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await citationApi.getCitationById(citationId);
        setCitation(response.data);
      } catch (err) {
        logger.error("Failed to fetch citation:", err);
        let errorMessage = "Failed to load citation";
        if (err.response?.status === 404) {
          errorMessage = "Citation not found";
        } else if (err.response?.data?.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.message) {
          errorMessage = err.message;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchCitation();
  }, [citationId]);

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

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar />
        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar />
        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            action={
              <Button color="inherit" size="small" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  if (!citation) {
    return null;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <AtlasButton
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </AtlasButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h2">Citation Details</Typography>
          <Typography variant="body2" color="text.secondary">
            ID: {citation.id}
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* Main Citation Info */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={3}>
                {/* Citation Text */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <GavelIcon color="primary" />
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Citation Text
                    </Typography>
                  </Stack>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: "action.hover",
                      borderColor: "primary.main",
                      borderWidth: 2,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.main" }}>
                      {citation.citation_text}
                    </Typography>
                  </Paper>
                </Box>

                <Divider />

                {/* Type and Confidence */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Classification
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                    <Chip
                      label={citation.citation_type || "Unknown"}
                      color={getCitationTypeColor(citation.citation_type)}
                      variant="outlined"
                      size="medium"
                    />
                    {citation.confidence_score && (
                      <Chip
                        label={`${citation.confidence_score} confidence`}
                        color={getConfidenceColor(citation.confidence_score)}
                        size="medium"
                      />
                    )}
                  </Stack>
                </Box>

                <Divider />

                {/* Metadata */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Metadata
                  </Typography>
                  <Stack spacing={2}>
                    {citation.year && (
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <CalendarTodayIcon color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Year
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {citation.year}
                          </Typography>
                        </Box>
                      </Stack>
                    )}

                    {citation.court && (
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <LocationOnIcon color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Court
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {citation.court}
                          </Typography>
                        </Box>
                      </Stack>
                    )}

                    {citation.reporter && (
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <DescriptionIcon color="action" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Reporter
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {citation.reporter}
                          </Typography>
                        </Box>
                      </Stack>
                    )}

                    {citation.page && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Page
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {citation.page}
                        </Typography>
                      </Box>
                    )}

                    {citation.volume && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Volume
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {citation.volume}
                        </Typography>
                      </Box>
                    )}

                    {citation.jurisdiction && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Jurisdiction
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {citation.jurisdiction}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>

                {/* Context */}
                {citation.context && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Context
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                        <Typography variant="body2" sx={{ fontStyle: "italic", lineHeight: 1.8 }}>
                          {citation.context}
                        </Typography>
                      </Paper>
                    </Box>
                  </>
                )}

                {/* Position Info */}
                {(citation.position_start !== null || citation.position_end !== null) && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Position in Document
                      </Typography>
                      <Typography variant="body2">
                        Characters {citation.position_start || 0} - {citation.position_end || 0}
                      </Typography>
                    </Box>
                  </>
                )}

                {/* Timestamp */}
                {citation.created_at && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Extracted: {formatDate(citation.created_at)}
                      </Typography>
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Document Info
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Document ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {citation.document_id}
                  </Typography>
                </Box>
                <AtlasButton
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate(`/documents/${citation.document_id}/citations`)}
                >
                  View All Citations
                </AtlasButton>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </Box>
    </Box>
  );
}

