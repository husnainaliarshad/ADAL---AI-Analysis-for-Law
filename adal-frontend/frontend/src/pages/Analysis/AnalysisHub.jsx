import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  alpha,
  Autocomplete,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GavelIcon from "@mui/icons-material/Gavel";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FindInPageOutlinedIcon from "@mui/icons-material/FindInPageOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import { motion as Motion } from "framer-motion";
import AtlasButton from "../../components/common/AtlasButton";
import CitationCard from "../../components/Citations/CitationCard";
import ClaimCard from "../../components/Claims/ClaimCard";
import Sidebar from "../../components/layout/Sidebar";
import citationApi from "../../api/citationApi";
import caseFactsApi from "../../api/caseFactsApi";
import claimApi from "../../api/claimApi";
import evidenceApi from "../../api/evidenceApi";
import summaryApi from "../../api/summaryApi";
import { fetchFiles } from "../../api/files";
import { normalizeConfidence } from "../../utils/confidence";
import { useNavigate } from "react-router-dom";

const TAB = { CITATIONS: 0, CLAIMS: 1, EVIDENCE: 2, CASE_FACTS: 3, SUMMARY: 4 };

// ── Small helpers ──────────────────────────────────────────────────────────────

function StatusChip({ doc }) {
  if (!doc) return null;
  const ready = doc.has_ocr_text;
  return (
    <Chip
      size="small"
      label={ready ? "OCR Ready" : "Needs OCR"}
      sx={{
        bgcolor: ready ? "rgba(127,119,221,0.15)" : "rgba(255,193,7,0.15)",
        color: ready ? "var(--violet)" : "warning.main",
        border: "1px solid",
        borderColor: ready ? "rgba(127,119,221,0.35)" : "rgba(255,193,7,0.35)",
        fontWeight: 600,
        fontSize: "0.7rem",
      }}
    />
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <Icon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
      <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
        {body}
      </Typography>
      {action}
    </Box>
  );
}

function PanelSkeleton() {
  return (
    <Grid container spacing={2}>
      {[...Array(6)].map((_, i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
        </Grid>
      ))}
    </Grid>
  );
}

// ── Tab panels ─────────────────────────────────────────────────────────────────

function CitationsPanel({ docId }) {
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await citationApi.getCitationsByDocument(docId);
      setCitations(res.data?.citations || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to load citations");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { setCitations([]); load(); }, [load]);

  const handleExtract = async () => {
    setRunning(true);
    setError(null);
    try {
      await citationApi.extractCitations(docId);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Extraction failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <PanelSkeleton />;
  if (error) return <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>;
  if (!citations.length) return (
    <EmptyState
      icon={GavelIcon}
      title="No citations found"
      body="Extract citations from this document to see them here."
      action={
        <AtlasButton variant="contained" startIcon={running ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />} onClick={handleExtract} disabled={running}>
          {running ? "Extracting…" : "Extract Citations"}
        </AtlasButton>
      }
    />
  );

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {citations.length} citation{citations.length !== 1 ? "s" : ""} found
        </Typography>
        <Stack direction="row" spacing={1}>
          <AtlasButton size="small" variant="outlined" startIcon={running ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />} onClick={handleExtract} disabled={running}>
            Re-extract
          </AtlasButton>
        </Stack>
      </Stack>
      <Grid container spacing={2}>
        {citations.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.id}>
            <CitationCard citation={c} onClick={() => navigate(`/citations/${c.id}`)} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}

function ClaimsPanel({ docId }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await claimApi.getClaimsByDocument(docId);
      const data = res?.data || {};
      setClaims(data.claims || data.items || data || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { setClaims([]); load(); }, [load]);

  const handleSegment = async () => {
    setRunning(true);
    setError(null);
    try {
      await claimApi.segmentClaims(docId);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Segmentation failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <PanelSkeleton />;
  if (error) return <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>;
  if (!claims.length) return (
    <EmptyState
      icon={FactCheckOutlinedIcon}
      title="No claims found"
      body="Segment this document to extract individual legal claims."
      action={
        <AtlasButton variant="contained" startIcon={running ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />} onClick={handleSegment} disabled={running}>
          {running ? "Segmenting…" : "Segment Claims"}
        </AtlasButton>
      }
    />
  );

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {claims.length} claim{claims.length !== 1 ? "s" : ""} found
        </Typography>
        <AtlasButton size="small" variant="outlined" startIcon={running ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />} onClick={handleSegment} disabled={running}>
          Re-segment
        </AtlasButton>
      </Stack>
      <Grid container spacing={2}>
        {claims.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.id || c.claim_id}>
            <ClaimCard claim={c} onClick={() => navigate(`/claims/${c.id || c.claim_id}`)} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}

function EvidencePanel({ docId }) {
  const theme = useTheme();
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await evidenceApi.getEvidenceByDocument(docId);
      const raw = res?.data?.evidence || res?.data || [];
      setEvidence(Array.isArray(raw) ? raw : []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      await evidenceApi.retrieveEvidenceForQuery(docId, searchQuery.trim());
      await load(); // Reload all evidence for this document
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to search evidence");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => { setEvidence([]); load(); }, [load]);

  if (loading && !searching && evidence.length === 0) return <PanelSkeleton />;
  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Enter custom query for similarity search... (e.g. 'breach of contract damages')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          InputProps={{
            startAdornment: <FindInPageOutlinedIcon sx={{ color: "text.secondary", mr: 1 }} />,
          }}
          disabled={searching}
        />
        <AtlasButton
          variant="contained"
          startIcon={searching ? <CircularProgress size={16} color="inherit" /> : <SearchOutlinedIcon />}
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          sx={{ minWidth: 140 }}
        >
          {searching ? "Searching…" : "Search"}
        </AtlasButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!evidence.length && !loading && !searching ? (
        <EmptyState
          icon={FindInPageOutlinedIcon}
          title="No evidence found"
          body="Enter a search query above to perform a similarity search on this document, or extract claims to see claim-specific evidence."
        />
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            {evidence.length} evidence snippet{evidence.length !== 1 ? "s" : ""} retrieved
          </Typography>
          <Grid container spacing={2}>
      {evidence.map((ev, i) => {
        const text = ev.paragraph_text || ev.content || ev.text || ev.passage || "";
        const score = ev.relevance_score ?? ev.score ?? ev.similarity;
        const pct = score != null ? `${Math.round(score * 100)}%` : null;
        return (
          <Grid item xs={12} md={6} key={ev.id || i}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 2,
                height: "100%",
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {ev.source_document_filename || `Evidence ${i + 1}`}
                  </Typography>
                  {pct && (
                    <Chip size="small" label={`${pct} match`} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontWeight: 600, fontSize: "0.7rem" }} />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {text || "No text available"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
    </>
    )}
    </Box>
  );
}

function formatFactItem(item) {
  if (item == null) return "";
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (Array.isArray(item)) return item.filter(Boolean).join(" - ");
  return Object.entries(item)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
    .join(" - ");
}

function FactSection({ title, items, empty = "Not identified in the document." }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : items ? [items] : [];

  return (
    <Card
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        height: "100%",
      }}
    >
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>
        {list.length ? (
          <Stack component="ul" spacing={1} sx={{ pl: 2.2, m: 0 }}>
            {list.map((item, index) => (
              <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }} key={`${title}-${index}`}>
                {formatFactItem(item)}
              </Typography>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ lineHeight: 1.7 }}>
            {empty}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function CaseFactsPanel({ docId }) {
  const theme = useTheme();
  const [facts, setFacts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await caseFactsApi.generateCaseFacts(docId);
      const data = res?.data || res;
      setFacts(data.case_facts || null);
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) setError("Document not found");
      else if (status === 400) setError(e.response?.data?.detail || "Document has no OCR text - extract text first");
      else setError(e.response?.data?.detail || e.message || "Failed to generate case facts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Structured Case Facts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Extract parties, dates, timeline, issues, relief, and missing facts from the OCR text.
          </Typography>
        </Box>
        <AtlasButton
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={handleGenerate}
          disabled={loading}
          sx={{ minWidth: 180 }}
        >
          {loading ? "Extracting..." : facts ? "Regenerate" : "Extract Facts"}
        </AtlasButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!facts && !loading && !error && (
        <EmptyState
          icon={AssignmentTurnedInOutlinedIcon}
          title="No case facts yet"
          body="Extract a structured fact sheet from this document using the LLM."
        />
      )}

      {loading && !facts && <PanelSkeleton />}

      {facts && (
        <Stack spacing={2}>
          <Card
            elevation={0}
            sx={{
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Case Overview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {facts.case_overview || "No overview was identified."}
              </Typography>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FactSection title="Parties" items={facts.parties} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Court or Forum" items={facts.court_or_forum} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Important Dates" items={facts.important_dates} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Relief Sought" items={facts.relief_sought} />
            </Grid>
            <Grid item xs={12}>
              <FactSection title="Events Timeline" items={facts.events_timeline} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Legal Issues" items={facts.legal_issues} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Important Facts" items={facts.important_facts} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Citations or Statutes" items={facts.citations_or_statutes} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FactSection title="Missing Information" items={facts.missing_information} />
            </Grid>
          </Grid>
        </Stack>
      )}
    </Box>
  );
}

function SummaryPanel({ docId }) {
  const theme = useTheme();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shortMode, setShortMode] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await summaryApi.generateSummary({ documentId: Number(docId), short: shortMode });
      const data = res?.data || res;
      setSummary(data.summary || "No summary returned");
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) setError("Document not found");
      else if (status === 400) setError(e.response?.data?.detail || "Document has no OCR text — extract text first");
      else setError(e.response?.data?.detail || e.message || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  const mdSx = {
    p: { fontSize: "0.97rem", lineHeight: 1.85, color: "text.primary", mb: 1 },
    h3: { fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "primary.main", mt: 2, mb: 0.5 },
    li: { fontSize: "0.96rem", lineHeight: 1.7, color: "text.primary", mb: 0.4 },
  };

  const components = {
    p: ({ node, ...props }) => <Typography sx={mdSx.p} {...props} />,
    h3: ({ node, ...props }) => <Typography sx={mdSx.h3} {...props} />,
    li: ({ node, ...props }) => <Typography component="li" sx={mdSx.li} {...props} />,
    ul: ({ node, ...props }) => <Box component="ul" sx={{ pl: 2.5, my: 1 }} {...props} />,
    strong: ({ node, ...props }) => <Box component="strong" sx={{ fontWeight: 700 }} {...props} />,
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mb: 3 }}>
        <FormControlLabel
          control={<Switch checked={shortMode} onChange={(e) => setShortMode(e.target.checked)} size="small" />}
          label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Short summary</Typography>}
        />
        <AtlasButton
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={handleGenerate}
          disabled={loading}
          sx={{ minWidth: 180 }}
        >
          {loading ? "Generating…" : summary ? "Regenerate" : "Generate Summary"}
        </AtlasButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!summary && !loading && !error && (
        <EmptyState
          icon={SummarizeOutlinedIcon}
          title="No summary yet"
          body="Click Generate Summary to create an AI-powered summary of this document."
        />
      )}

      {summary && (
        <Card
          elevation={0}
          sx={{
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <ReactMarkdown components={components}>{summary}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ── Main Hub ───────────────────────────────────────────────────────────────────

export default function AnalysisHub() {
  const theme = useTheme();
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [tab, setTab] = useState(TAB.CITATIONS);

  useEffect(() => {
    fetchFiles({ limit: 200 })
      .then(({ files }) => setDocuments(files))
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, []);

  const tabItems = [
    { label: "Citations", icon: <GavelIcon sx={{ fontSize: 18 }} /> },
    { label: "Claims", icon: <FactCheckOutlinedIcon sx={{ fontSize: 18 }} /> },
    { label: "Evidence", icon: <SearchOutlinedIcon sx={{ fontSize: 18 }} /> },
    { label: "Case Facts", icon: <AssignmentTurnedInOutlinedIcon sx={{ fontSize: 18 }} /> },
    { label: "Summary", icon: <SummarizeOutlinedIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar />

      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto", width: "100%" }}>
        {/* Header */}
        <Motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Stack spacing={0.5} sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, var(--text-primary) 0%, var(--violet) 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Analysis Hub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Citations, claims, evidence, and summaries — all in one place.
            </Typography>
          </Stack>
        </Motion.div>

        {/* Document Picker */}
        <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
          <Card
            elevation={0}
            sx={{
              mb: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
            }}
          >
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "8px",
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <DescriptionOutlinedIcon sx={{ fontSize: 20, color: "primary.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      Select Document
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {documents.length} document{documents.length !== 1 ? "s" : ""} available
                    </Typography>
                  </Box>
                </Box>

                <Autocomplete
                  sx={{ flex: 1 }}
                  options={documents}
                  loading={docsLoading}
                  value={selectedDoc}
                  onChange={(_, v) => { setSelectedDoc(v); setTab(TAB.CITATIONS); }}
                  getOptionLabel={(o) => o.filename || o.name || `Document ${o.id}`}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search documents…"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {docsLoading && <CircularProgress size={16} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <DescriptionOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {option.filename || option.name || `Document ${option.id}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {option.id}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                />

                {selectedDoc && <StatusChip doc={selectedDoc} />}
              </Stack>
            </CardContent>
          </Card>
        </Motion.div>

        {/* Tabs + Content */}
        {selectedDoc ? (
          <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.14 }}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              {/* Tab Bar */}
              <Box
                sx={{
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  bgcolor: alpha(theme.palette.background.paper, 0.4),
                  px: 2,
                }}
              >
                <Tabs
                  value={tab}
                  onChange={(_, v) => setTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    "& .MuiTab-root": {
                      minHeight: 52,
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      textTransform: "none",
                      gap: 0.75,
                    },
                    "& .Mui-selected": { color: "primary.main", fontWeight: 700 },
                    "& .MuiTabs-indicator": { bgcolor: "primary.main", height: 2 },
                  }}
                >
                  {tabItems.map((t, i) => (
                    <Tab
                      key={t.label}
                      label={t.label}
                      icon={t.icon}
                      iconPosition="start"
                      id={`analysis-tab-${i}`}
                      aria-controls={`analysis-panel-${i}`}
                    />
                  ))}
                </Tabs>
              </Box>

              {/* Panel Content */}
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                {tab === TAB.CITATIONS && <CitationsPanel docId={selectedDoc.id} key={`citations-${selectedDoc.id}`} />}
                {tab === TAB.CLAIMS && <ClaimsPanel docId={selectedDoc.id} key={`claims-${selectedDoc.id}`} />}
                {tab === TAB.EVIDENCE && <EvidencePanel docId={selectedDoc.id} key={`evidence-${selectedDoc.id}`} />}
                {tab === TAB.CASE_FACTS && <CaseFactsPanel docId={selectedDoc.id} key={`case-facts-${selectedDoc.id}`} />}
                {tab === TAB.SUMMARY && <SummaryPanel docId={selectedDoc.id} key={`summary-${selectedDoc.id}`} />}
              </CardContent>
            </Card>
          </Motion.div>
        ) : (
          <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <Box
              sx={{
                textAlign: "center",
                py: 12,
                px: 2,
                border: `1px dashed ${alpha(theme.palette.divider, 0.5)}`,
                borderRadius: 3,
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "16px",
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 2,
                }}
              >
                <DescriptionOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.75 }}>
                Select a document to get started
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: "auto" }}>
                Pick any document from the picker above, then use the tabs to run citation extraction, claim segmentation, evidence retrieval, or generate an AI summary.
              </Typography>
            </Box>
          </Motion.div>
        )}
      </Box>
    </Box>
  );
}
