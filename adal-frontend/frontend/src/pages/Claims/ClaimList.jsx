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
  Grid,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AtlasButton from "../../components/common/AtlasButton";
import ClaimCard from "../../components/Claims/ClaimCard";
import claimApi from "../../api/claimApi";
import { formatDate } from "../../utils/helpers";
import { PAGINATION } from "../../utils/constants";
import { normalizeConfidence } from "../../utils/confidence";
import logger from "../../utils/logger";
import Sidebar from "../../components/layout/Sidebar";

export default function ClaimList() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const documentId = params.documentId || searchParams.get("documentId") || null;

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [viewMode, setViewMode] = useState("grid"); // grid or table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGINATION.DEFAULT_PAGE_SIZE);

  const fetchClaims = async (isRetry = false) => {
    try {
      setLoading(true);
      setError(null);
      if (isRetry) setRetryCount((prev) => prev + 1);

      const res = documentId
        ? await claimApi.getClaimsByDocument(documentId)
        : await claimApi.getAllClaims();

      const data = res?.data || {};
      const list = data.claims || data.items || data || [];
      setClaims(list);
      setRetryCount(0);
    } catch (err) {
      logger.error("Failed to fetch claims:", err);
      let msg = "Failed to load claims";
      if (err.response?.status === 404) msg = "Claims not found";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [documentId]);

  const handleClaimClick = (claim) => navigate(`/claims/${claim.id || claim.claim_id}`);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto", width: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AtlasButton
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              size="small"
            >
              Back
            </AtlasButton>
            <Box>
              <Typography variant="h2">Claims</Typography>
              {documentId && (
                <Typography variant="body2" color="text.secondary">
                  Document {documentId}
                </Typography>
              )}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <AtlasButton variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetchClaims()}>
              Refresh
            </AtlasButton>
          </Stack>
        </Stack>

        <Card>
          <CardContent>
            {error && !loading && (
              <Alert
                severity="error"
                icon={<ErrorOutlineIcon />}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => fetchClaims(true)}
                    startIcon={<RefreshIcon />}
                  >
                    Retry
                  </Button>
                }
                sx={{ mb: 2 }}
              >
                {error}
                {retryCount > 0 && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Retry attempt: {retryCount}
                  </Typography>
                )}
              </Alert>
            )}

            <Divider sx={{ mb: 3 }} />

            {!loading && !error && (
              <Box sx={{ mb: 2, display: "flex", gap: 1, alignItems: "center" }}>
                <GavelIcon color="primary" />
                <Typography variant="h6">
                  {claims.length} Claim{claims.length === 1 ? "" : "s"}
                </Typography>
                <Chip
                  label={viewMode === "grid" ? "Grid view" : "Table view"}
                  size="small"
                  variant="outlined"
                  onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
                  sx={{ ml: "auto", cursor: "pointer" }}
                />
              </Box>
            )}

            {loading && (
              <Grid container spacing={2}>
                {[...Array(6)].map((_, idx) => (
                  <Grid item xs={12} sm={6} md={4} key={`claim-skeleton-${idx}`}>
                    <Skeleton variant="rectangular" height={180} />
                  </Grid>
                ))}
              </Grid>
            )}

            {!loading && !error && claims.length === 0 && (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <GavelIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No claims found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {documentId ? "Segment this document to create claims." : "Upload and segment documents to see claims."}
                </Typography>
              </Box>
            )}

            {!loading && !error && claims.length > 0 && viewMode === "grid" && (
              <>
                <Grid container spacing={2}>
                  {claims
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((claim) => (
                      <Grid item xs={12} sm={6} md={4} key={claim.id || claim.claim_id}>
                        <ClaimCard claim={claim} onClick={() => handleClaimClick(claim)} />
                      </Grid>
                    ))}
                </Grid>
                <TablePagination
                  component="div"
                  count={claims.length}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={PAGINATION.PAGE_SIZES}
                  sx={{ mt: 2 }}
                />
              </>
            )}

            {!loading && !error && claims.length > 0 && viewMode === "table" && (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Claim</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Confidence</TableCell>
                        <TableCell>Document</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {claims
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((claim) => {
                          const confidence = normalizeConfidence(claim.confidence_score);
                          return (
                            <TableRow
                              key={claim.id || claim.claim_id}
                              hover
                              sx={{ cursor: "pointer" }}
                              onClick={() => handleClaimClick(claim)}
                            >
                              <TableCell sx={{ fontWeight: 600, maxWidth: 380 }}>
                                {claim.claim_text || "-"}
                              </TableCell>
                              <TableCell>{claim.claim_type || "-"}</TableCell>
                              <TableCell>
                                {claim.confidence_score && (
                                  <Chip
                                    size="small"
                                    label={`${confidence.percent} (${confidence.level})`}
                                    color={confidence.chipColor}
                                    sx={{ color: "white" }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>{claim.document_id || "-"}</TableCell>
                              <TableCell>{claim.created_at ? formatDate(claim.created_at) : "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={claims.length}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={PAGINATION.PAGE_SIZES}
                />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

