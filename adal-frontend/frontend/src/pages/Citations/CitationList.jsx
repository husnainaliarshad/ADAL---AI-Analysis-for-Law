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
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import { useNavigate, useParams } from "react-router-dom";
import AtlasButton from "../../components/common/AtlasButton";
import CitationExtractor from "../../components/Citations/CitationExtractor";
import CitationCard from "../../components/Citations/CitationCard";
import { formatDate } from "../../utils/helpers";
import { PAGINATION } from "../../utils/constants";
import citationApi from "../../api/citationApi";
import documentApi from "../../api/documentApi";
import logger from "../../utils/logger";
import Sidebar from "../../components/layout/Sidebar";

export default function CitationList() {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const [citations, setCitations] = useState([]);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGINATION.DEFAULT_PAGE_SIZE);

  const fetchCitations = async (isRetry = false) => {
    if (!documentId) {
      setError("Document ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isRetry) {
        setRetryCount((prev) => prev + 1);
      }

      // Fetch document info
      const docResponse = await documentApi.getDocumentById(documentId);
      setDocument(docResponse.data);

      // Fetch citations
      const response = await citationApi.getCitationsByDocument(documentId);
      const data = response.data;
      setCitations(data.citations || []);
      setRetryCount(0);
    } catch (err) {
      logger.error("Failed to fetch citations:", err);
      let errorMessage = "Failed to load citations";
      if (err.response?.status === 404) {
        errorMessage = "Document or citations not found";
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

  useEffect(() => {
    fetchCitations();
  }, [documentId]);

  const handleExtracted = () => {
    // Refresh citations after extraction
    fetchCitations();
  };

  const handleCitationClick = (citation) => {
    navigate(`/citations/${citation.id}`);
  };

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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto", width: "100%" }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <AtlasButton
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            size="small"
          >
            Back
          </AtlasButton>
          <Box>
            <Typography variant="h2">Citations</Typography>
            {document && (
              <Typography variant="body2" color="text.secondary">
                {document.filename}
              </Typography>
            )}
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <AtlasButton
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchCitations()}
            disabled={loading}
          >
            Refresh
          </AtlasButton>
          {documentId && (
            <CitationExtractor
              documentId={parseInt(documentId)}
              onExtracted={handleExtracted}
              disabled={loading}
            />
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          {/* Error Alert */}
          {error && !loading && (
            <Alert
              severity="error"
              icon={<ErrorOutlineIcon />}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => fetchCitations(true)}
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

          {/* Stats */}
          {!loading && !error && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <GavelIcon color="primary" />
                <Typography variant="h6">
                  {citations.length} Citation{citations.length !== 1 ? "s" : ""} Found
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  color="primary"
                  value={viewMode}
                  exclusive
                  onChange={(_, next) => {
                    if (next) setViewMode(next);
                  }}
                  sx={{ ml: { xs: 0, md: "auto" } }}
                >
                  <ToggleButton value="grid">Grid</ToggleButton>
                  <ToggleButton value="table">Table</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Box>
          )}

          {/* Loading State */}
          {loading && (
            <Grid container spacing={2}>
              {[...Array(6)].map((_, idx) => (
                <Grid item xs={12} sm={6} md={4} key={`skeleton-${idx}`}>
                  <Skeleton variant="rectangular" height={200} />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Empty State */}
          {!loading && !error && citations.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <GavelIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No Citations Found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                This document doesn't have any citations yet. Extract citations to get started.
              </Typography>
              {documentId && (
                <CitationExtractor
                  documentId={parseInt(documentId)}
                  onExtracted={handleExtracted}
                />
              )}
            </Box>
          )}

          {/* Grid View */}
          {!loading && !error && citations.length > 0 && viewMode === "grid" && (
            <>
              <Grid container spacing={2}>
                {citations
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((citation) => (
                    <Grid item xs={12} sm={6} md={4} key={citation.id}>
                      <CitationCard
                        citation={citation}
                        onClick={() => handleCitationClick(citation)}
                      />
                    </Grid>
                  ))}
              </Grid>
              <TablePagination
                component="div"
                count={citations.length}
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

          {/* Table View */}
          {!loading && !error && citations.length > 0 && viewMode === "table" && (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Citation Text</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Court</TableCell>
                      <TableCell>Year</TableCell>
                      <TableCell>Reporter</TableCell>
                      <TableCell>Confidence</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {citations
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((citation) => (
                        <TableRow
                          key={citation.id}
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => handleCitationClick(citation)}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>
                            {citation.citation_text}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={citation.citation_type}
                              size="small"
                              color={getCitationTypeColor(citation.citation_type)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{citation.court || "-"}</TableCell>
                          <TableCell>{citation.year || "-"}</TableCell>
                          <TableCell>{citation.reporter || "-"}</TableCell>
                          <TableCell>
                            {citation.confidence_score && (
                              <Chip
                                label={citation.confidence_score}
                                size="small"
                                color={
                                  citation.confidence_score === "high"
                                    ? "success"
                                    : citation.confidence_score === "medium"
                                    ? "warning"
                                    : "error"
                                }
                                sx={{ color: "white" }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {citation.created_at
                              ? formatDate(citation.created_at)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={citations.length}
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

