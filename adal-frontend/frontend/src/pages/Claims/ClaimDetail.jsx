import React, { useEffect, useState } from "react";
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
  Grid,
  Skeleton,
  Paper,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNavigate, useParams } from "react-router-dom";
import AtlasButton from "../../components/common/AtlasButton";
import ClaimCard from "../../components/Claims/ClaimCard";
import claimApi from "../../api/claimApi";
import { formatDate } from "../../utils/helpers";
import { normalizeConfidence } from "../../utils/confidence";
import logger from "../../utils/logger";
import Sidebar from "../../components/layout/Sidebar";

export default function ClaimDetail() {
  const { claimId } = useParams();
  const navigate = useNavigate();

  const [claim, setClaim] = useState(null);
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [citationsError, setCitationsError] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!claimId) {
        setError("Claim ID is required");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await claimApi.getClaimById(claimId);
        setClaim(res?.data || res);
      } catch (err) {
        logger.error("Failed to fetch claim:", err);
        let msg = "Failed to load claim";
        if (err.response?.status === 404) msg = "Claim not found";
        else if (err.response?.data?.detail) msg = err.response.data.detail;
        else if (err.message) msg = err.message;
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [claimId]);

  useEffect(() => {
    const loadCitations = async () => {
      if (!claimId) return;
      try {
        setCitationsError(null);
        const res = await claimApi.getClaimCitations(claimId);
        const data = res?.data || {};
        setCitations(data.citations || data || []);
      } catch (err) {
        logger.error("Failed to fetch claim citations:", err);
        let msg = "Failed to load citations";
        if (err.response?.status === 404) msg = "Citations not found for this claim";
        else if (err.response?.data?.detail) msg = err.response.data.detail;
        else if (err.message) msg = err.message;
        setCitationsError(msg);
      }
    };
    loadCitations();
  }, [claimId]);

  const confidence = normalizeConfidence(claim?.confidence_score);

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

  if (!claim) return null;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <AtlasButton variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </AtlasButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h2">Claim Details</Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {claim.id || claim.claim_id}
            </Typography>
          </Box>
          {claim.document_id && (
            <AtlasButton
              variant="contained"
              startIcon={<DescriptionIcon />}
              onClick={() => navigate(`/documents/${claim.document_id}/claims`)}
            >
              View Document Claims
            </AtlasButton>
          )}
        </Stack>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={3}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                      <GavelIcon color="primary" />
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        Claim Text
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
                        {claim.claim_text}
                      </Typography>
                    </Paper>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Metadata
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      {claim.claim_type && (
                        <Chip label={claim.claim_type} color="primary" variant="outlined" />
                      )}
                      {claim.confidence_score && (
                        <Chip
                          label={`${confidence.percent} (${confidence.level})`}
                          color={confidence.chipColor}
                          sx={{ color: "white" }}
                        />
                      )}
                      {claim.claim_number != null && <Chip label={`#${claim.claim_number}`} />}
                      {claim.section && <Chip label={`Section ${claim.section}`} />}
                    </Stack>
                  </Box>

                  {claim.context && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                          Context
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                            {claim.context}
                          </Typography>
                        </Paper>
                      </Box>
                    </>
                  )}

                  {claim.created_at && (
                    <>
                      <Divider />
                      <Typography variant="caption" color="text.secondary">
                        Extracted: {formatDate(claim.created_at)}
                      </Typography>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Citations
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {citationsError && (
                  <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 2 }}>
                    {citationsError}
                  </Alert>
                )}
                {!citationsError && citations.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No citations linked to this claim.
                  </Typography>
                )}
                <Stack spacing={2}>
                  {citations.map((citation) => (
                    <ClaimCard key={citation.id} claim={{ claim_text: citation.citation_text }} onClick={() => navigate(`/citations/${citation.id}`)} />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

