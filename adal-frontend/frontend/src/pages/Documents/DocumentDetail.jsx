import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  FormControlLabel,
  Link as MuiLink,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import GavelIcon from "@mui/icons-material/Gavel";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import CitationCard from "../../components/Citations/CitationCard";
import ClaimCard from "../../components/Claims/ClaimCard";
import SummarizeIcon from "../../components/icons/SummarizeIcon";
import Sidebar from "../../components/layout/Sidebar";
import claimApi from "../../api/claimApi";
import citationApi from "../../api/citationApi";
import documentApi from "../../api/documentApi";
import evidenceApi from "../../api/evidenceApi";
import summaryApi from "../../api/summaryApi";
import useDocumentUpdates from "../../hooks/useDocumentUpdates";
import { ROUTES } from "../../utils/constants";
import { formatBytes, formatDate } from "../../utils/helpers";
import logger from "../../utils/logger";

const tabs = {
  OVERVIEW: "overview",
  CITATIONS: "citations",
  CLAIMS: "claims",
  EVIDENCE: "evidence",
  RAW_TEXT: "raw_text",
};

function getStatusConfig(document) {
  if (document?.has_ocr_text) {
    return {
      label: "OCR Ready",
      tone: "ok",
      summary: "Ready for summary, citations, claims, and evidence review.",
    };
  }

  return {
    label: "Needs OCR",
    tone: "warn",
    summary: "Extract text before using legal analysis features.",
  };
}

function normalizeEvidenceRecords(raw = []) {
  return raw.map((ev, index) => ({
    ...ev,
    id: ev.id ?? `ev-${index}`,
    content: ev.paragraph_text ?? ev.content ?? ev.text ?? ev.passage,
    text: ev.paragraph_text ?? ev.text,
    passage: ev.paragraph_text ?? ev.passage,
    score: ev.relevance_score ?? ev.score ?? ev.similarity,
    similarity: ev.relevance_score ?? ev.similarity,
    title: ev.source_document_filename
      ? `From ${ev.source_document_filename}`
      : ev.title ?? `Evidence ${ev.id ?? index + 1}`,
  }));
}

function getClaimModelPresentation(status) {
  if (!status) {
    return {
      label: "Claim Model Unknown",
      tone: "neutral",
      copy: "Checking whether InLegalBERT is already loaded.",
    };
  }

  if (status.state === "ready" || status.is_loaded) {
    return {
      label: `Claim Model Ready${status.device ? ` (${String(status.device).toUpperCase()})` : ""}`,
      tone: "ok",
      copy: "Claim segmentation can run without waiting for the model to cold-load.",
    };
  }

  if (status.state === "loading") {
    return {
      label: "Claim Model Warming",
      tone: "warn",
      copy: "InLegalBERT is loading in the backend. The first segmentation request can take longer than usual.",
    };
  }

  if (status.state === "error") {
    return {
      label: "Claim Model Error",
      tone: "warn",
      copy: status.last_error || "The last model warmup attempt failed. Retry warmup or inspect backend logs.",
    };
  }

  return {
    label: status.cache_present ? "Claim Model Cached" : "Claim Model Cold",
    tone: status.cache_present ? "neutral" : "warn",
    copy: status.cache_present
      ? "Model files are cached locally, but they are not loaded into memory yet."
      : "Model files are not fully loaded yet. The first claim segmentation can take noticeably longer.",
  };
}

export default function DocumentDetail() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState(null);

  const [citations, setCitations] = useState([]);
  const [citationsLoading, setCitationsLoading] = useState(true);
  const [citationsError, setCitationsError] = useState(null);

  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState(null);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [extractSuccess, setExtractSuccess] = useState(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryText, setSummaryText] = useState(null);
  const [shortSummary, setShortSummary] = useState(false);

  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);
  const [citationExtracting, setCitationExtracting] = useState(false);
  const [claimSegmenting, setClaimSegmenting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [claimModelStatus, setClaimModelStatus] = useState(null);
  const [claimModelStatusError, setClaimModelStatusError] = useState(null);
  const [claimModelWarmupPending, setClaimModelWarmupPending] = useState(false);

  const [activeTab, setActiveTab] = useState(tabs.OVERVIEW);

  const resolvedDocumentId = useMemo(() => {
    if (!documentId) return null;
    const asNumber = Number(documentId);
    return Number.isNaN(asNumber) ? null : asNumber;
  }, [documentId]);

  const loadDocument = useCallback(async () => {
    if (!resolvedDocumentId) {
      setDocError("Document ID is required");
      setDocLoading(false);
      return;
    }

    try {
      setDocLoading(true);
      setDocError(null);
      const res = await documentApi.getDocumentById(resolvedDocumentId);
      setDocument(res.data || res);
    } catch (err) {
      logger.error("Failed to load document", err);
      let msg = "Failed to load document";
      if (err.response?.status === 404) msg = "Document not found";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setDocError(msg);
    } finally {
      setDocLoading(false);
    }
  }, [resolvedDocumentId]);

  const loadCitations = useCallback(async () => {
    if (!resolvedDocumentId) {
      setCitationsError("Document ID is required");
      setCitationsLoading(false);
      return;
    }

    try {
      setCitationsLoading(true);
      setCitationsError(null);
      const res = await citationApi.getCitationsByDocument(resolvedDocumentId);
      const data = res?.data || {};
      setCitations(data.citations || data || []);
    } catch (err) {
      logger.error("Failed to load citations", err);
      let msg = "Failed to load citations";
      if (err.response?.status === 404) msg = "Citations not found for this document";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setCitationsError(msg);
    } finally {
      setCitationsLoading(false);
    }
  }, [resolvedDocumentId]);

  const loadClaims = useCallback(async () => {
    if (!resolvedDocumentId) {
      setClaimsError("Document ID is required");
      setClaimsLoading(false);
      return;
    }

    try {
      setClaimsLoading(true);
      setClaimsError(null);
      const res = await claimApi.getClaimsByDocument(resolvedDocumentId);
      const data = res?.data || {};
      setClaims(data.claims || data.items || data || []);
    } catch (err) {
      logger.error("Failed to load claims", err);
      let msg = "Failed to load claims";
      if (err.response?.status === 404) msg = "Claims not found for this document";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setClaimsError(msg);
    } finally {
      setClaimsLoading(false);
    }
  }, [resolvedDocumentId]);

  const loadClaimModelStatus = useCallback(async () => {
    try {
      setClaimModelStatusError(null);
      const res = await claimApi.getClaimModelStatus();
      setClaimModelStatus(res?.data || res);
    } catch (err) {
      logger.error("Failed to load claim model status", err);
      let msg = "Failed to load claim model status";
      if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setClaimModelStatusError(msg);
    }
  }, []);

  const handleWarmClaimModel = useCallback(async () => {
    try {
      setClaimModelWarmupPending(true);
      setClaimModelStatusError(null);
      const res = await claimApi.warmupClaimModel();
      setClaimModelStatus(res?.data || res);
    } catch (err) {
      logger.error("Failed to warm claim model", err);
      let msg = "Failed to start claim model warmup";
      if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setClaimModelStatusError(msg);
    } finally {
      setClaimModelWarmupPending(false);
    }
  }, []);

  const loadExistingEvidence = useCallback(async () => {
    if (!resolvedDocumentId) {
      setEvidenceError("Document ID is required");
      return [];
    }

    const res = await evidenceApi.getEvidenceByDocument(resolvedDocumentId);
    const data = res?.data || res;
    const normalized = normalizeEvidenceRecords(data.evidence || []);
    setEvidenceList(normalized);
    return normalized;
  }, [resolvedDocumentId]);

  const handleLoadEvidence = useCallback(async () => {
    if (!resolvedDocumentId) return;

    setActiveTab(tabs.EVIDENCE);
    setEvidenceLoading(true);
    setEvidenceError(null);

    try {
      const existingEvidence = await loadExistingEvidence();
      if (existingEvidence.length > 0) {
        return;
      }

      let availableClaims = claims;
      if (availableClaims.length === 0) {
        const claimsRes = await claimApi.getClaimsByDocument(resolvedDocumentId);
        const claimsData = claimsRes?.data || {};
        availableClaims = claimsData.claims || claimsData.items || claimsData || [];
        setClaims(Array.isArray(availableClaims) ? availableClaims : []);
      }

      if (!Array.isArray(availableClaims) || availableClaims.length === 0) {
        setEvidenceError("Segment claims first. Evidence is retrieved per claim.");
        setActiveTab(tabs.CLAIMS);
        return;
      }

      await Promise.all(
        availableClaims.map((claim) =>
          evidenceApi.retrieveEvidenceForClaim(claim.id ?? claim.claim_id, {
            k: 10,
            threshold: 0.3,
          }),
        ),
      );

      await loadExistingEvidence();
    } catch (err) {
      let msg = "Failed to load evidence";
      if (err.response?.status === 404) msg = "Evidence not found for this document";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setEvidenceError(msg);
    } finally {
      setEvidenceLoading(false);
    }
  }, [claims, loadExistingEvidence, resolvedDocumentId]);

  useEffect(() => {
    loadDocument();
    loadCitations();
    loadClaims();
  }, [loadClaims, loadCitations, loadDocument]);

  useEffect(() => {
    loadClaimModelStatus();
  }, [loadClaimModelStatus]);

  useEffect(() => {
    if (!extractSuccess) return undefined;
    const timer = setTimeout(() => setExtractSuccess(null), 2500);
    return () => clearTimeout(timer);
  }, [extractSuccess]);

  useEffect(() => {
    if (!actionSuccess) return undefined;
    const timer = setTimeout(() => setActionSuccess(null), 2500);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

  useEffect(() => {
    const shouldPoll = claimSegmenting || claimModelWarmupPending || claimModelStatus?.state === "loading";
    if (!shouldPoll) return undefined;

    const interval = setInterval(() => {
      loadClaimModelStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [claimModelStatus?.state, claimModelWarmupPending, claimSegmenting, loadClaimModelStatus]);

  useDocumentUpdates((event) => {
    if (event?.type !== "documents.updated" || !resolvedDocumentId) return;

    const eventDocumentId = Number(event.document_id);
    if (eventDocumentId !== resolvedDocumentId) return;

    if (event.action === "deleted") {
      navigate(ROUTES.DOCUMENTS, { replace: true });
      return;
    }

    loadDocument();
    loadCitations();
    loadClaims();
    if (evidenceList.length > 0) {
      loadExistingEvidence().catch((err) => {
        logger.error("Failed to refresh evidence after live update", err);
      });
    }
  }, Boolean(resolvedDocumentId));

  const handleExtractCitations = async () => {
    if (!resolvedDocumentId) return;

    setCitationExtracting(true);
    setActionError(null);
    setActionSuccess(null);
    setCitationsError(null);

    try {
      await citationApi.deleteCitations(resolvedDocumentId);
      const res = await citationApi.extractCitations(resolvedDocumentId);
      const data = res?.data || {};
      const nextCitations = data.citations || data || [];
      const citationCount = data.total_citations ?? nextCitations.length ?? 0;

      setCitations(Array.isArray(nextCitations) ? nextCitations : []);
      setActiveTab(tabs.CITATIONS);
      setActionSuccess(`Extracted ${citationCount} citation${citationCount === 1 ? "" : "s"}.`);
    } catch (err) {
      let msg = "Failed to extract citations";
      if (err.response?.status === 404) msg = "Document not found. Please verify the file still exists.";
      else if (err.response?.status === 400) msg = err.response?.data?.detail || "Document has no OCR text. Extract text first.";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setActionError(msg);
    } finally {
      setCitationExtracting(false);
    }
  };

  const handleSegmentClaims = async () => {
    if (!resolvedDocumentId) return;

    setClaimSegmenting(true);
    setActionError(null);
    setActionSuccess(null);
    setClaimsError(null);
    setEvidenceError(null);

    try {
      await Promise.all([
        claimApi.deleteClaims(resolvedDocumentId),
        evidenceApi.deleteDocumentEvidence(resolvedDocumentId),
      ]);

      const res = await claimApi.segmentClaims(resolvedDocumentId, true);
      const data = res?.data || {};
      const nextClaims = data.claims || data.items || data || [];
      const claimCount = data.total_claims ?? nextClaims.length ?? 0;

      setClaims(Array.isArray(nextClaims) ? nextClaims : []);
      setEvidenceList([]);
      setActiveTab(tabs.CLAIMS);
      setActionSuccess(`Segmented ${claimCount} claim${claimCount === 1 ? "" : "s"}.`);
    } catch (err) {
      let msg = "Failed to segment claims";
      if (err.response?.status === 404) msg = "Document not found or not ready for claim segmentation.";
      else if (err.response?.status === 400) msg = err.response?.data?.detail || "Document has no OCR text. Extract text first.";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setActionError(msg);
    } finally {
      loadClaimModelStatus();
      setClaimSegmenting(false);
    }
  };

  const handleOpenRawText = () => {
    setActiveTab(tabs.RAW_TEXT);
  };

  const handleSummarize = async () => {
    if (!resolvedDocumentId) return;

    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryText(null);

    try {
      const res = await summaryApi.generateSummary({ documentId: resolvedDocumentId, short: shortSummary });
      const data = res?.data || res;
      setSummaryText(data.summary || "No summary returned.");
    } catch (err) {
      let msg = "Failed to generate summary";
      if (err.response?.status === 404) msg = "Document not found";
      else if (err.response?.status === 400) msg = err.response?.data?.detail || "Document has no OCR text";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setSummaryError(msg);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExtractText = async () => {
    if (!resolvedDocumentId) return;

    setExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);

    try {
      await documentApi.extractText(resolvedDocumentId);
      setExtractSuccess("Text extraction started successfully.");
      loadDocument();
    } catch (err) {
      logger.error("Extract text error", err);
      let msg = "Failed to start text extraction";
      if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setExtractError(msg);
    } finally {
      setExtracting(false);
    }
  };

  const documentTitle = document?.filename || document?.name || "Document Detail";
  const fileSizeDisplay = useMemo(() => {
    if (!document) return "-";
    if (document.file_size_bytes) return formatBytes(document.file_size_bytes);
    if (typeof document.file_size_mb === "number") return `${document.file_size_mb.toFixed(2)} MB`;
    return "-";
  }, [document]);

  const status = useMemo(() => getStatusConfig(document), [document]);
  const claimModelPresentation = useMemo(
    () => getClaimModelPresentation(claimModelStatus),
    [claimModelStatus],
  );

  const metrics = useMemo(() => ([
    {
      label: "OCR Text Length",
      value: document?.ocr_text_length ? `${Math.round(document.ocr_text_length / 1000)}k` : "00",
      sublabel: document?.has_ocr_text ? "Extraction completed successfully" : "Text not available yet",
      tone: document?.has_ocr_text ? "good" : "warn",
    },
    {
      label: "Citations Found",
      value: String(citations.length).padStart(2, "0"),
      sublabel: citations.length > 0 ? "Authorities ready for review" : "No citations extracted yet",
      tone: citations.length > 0 ? "good" : "default",
    },
    {
      label: "Claims Segmented",
      value: String(claims.length).padStart(2, "0"),
      sublabel: claims.length > 0 ? "Legal propositions available" : "No claims segmented yet",
      tone: claims.length > 0 ? "good" : "default",
    },
    {
      label: "Evidence Links",
      value: String(evidenceList.length).padStart(2, "0"),
      sublabel: evidenceList.length > 0 ? "Supporting passages loaded" : "Load evidence when ready",
      tone: evidenceList.length > 0 ? "good" : "warn",
    },
  ]), [claims.length, citations.length, document?.has_ocr_text, document?.ocr_text_length, evidenceList.length]);

  const metadataRows = useMemo(() => ([
    { label: "Document ID", value: document?.id || document?.document_id || "-" },
    { label: "Filename", value: document?.filename || document?.name || "-" },
    { label: "Uploaded", value: document?.created_at ? formatDate(document.created_at) : "-" },
    { label: "File Type", value: document?.file_type || document?.type || "Unknown" },
    { label: "File Size", value: fileSizeDisplay },
    { label: "OCR Status", value: document?.has_ocr_text ? "Available" : "Missing" },
  ]), [document, fileSizeDisplay]);

  const timelineItems = useMemo(() => {
    const items = [
      {
        title: "File uploaded successfully",
        copy: "The original file was stored and linked to the document workspace.",
        time: document?.created_at ? formatDate(document.created_at) : "Recorded",
      },
    ];

    if (document?.has_ocr_text) {
      items.push({
        title: "OCR text extracted",
        copy: "Text is available for summaries, citations, claims, and downstream legal review.",
        time: "Ready",
      });
    }

    if (citations.length > 0) {
      items.push({
        title: "Citations detected",
        copy: `${citations.length} citation${citations.length === 1 ? "" : "s"} found for review and verification.`,
        time: "Indexed",
      });
    }

    if (claims.length > 0) {
      items.push({
        title: "Claims segmented",
        copy: `${claims.length} extracted legal claim${claims.length === 1 ? "" : "s"} available for validation.`,
        time: "Segmented",
      });
    }

    return items;
  }, [claims.length, citations.length, document?.created_at, document?.has_ocr_text]);

  const overviewSignals = useMemo(() => {
    const signals = [];

    if (!document?.has_ocr_text) {
      signals.push({
        title: "Text extraction should be the first step",
        copy: "This file cannot be summarized or cited reliably until OCR text is available.",
      });
    }

    if (citations.length > 0) {
      signals.push({
        title: "Authorities are already detected",
        copy: "Open the citations tab to verify extracted references and decide which authorities matter most.",
      });
    }

    if (claims.length > 0) {
      signals.push({
        title: "Claims and citations should be reviewed together",
        copy: "The strongest workflow is to compare extracted legal propositions against their supporting authorities before drafting.",
      });
    }

    if (claims.length > 0 && evidenceList.length === 0) {
      signals.push({
        title: "Evidence can now be loaded",
        copy: "Because claims exist, this document is ready for evidence retrieval across supporting passages.",
      });
    }

    if (signals.length === 0) {
      signals.push({
        title: "This document needs further processing",
        copy: "Start with OCR extraction or summary generation so the page becomes actionable instead of just descriptive.",
      });
    }

    return signals.slice(0, 3);
  }, [claims.length, citations.length, document?.has_ocr_text, evidenceList.length]);

  const previewCitations = citations.slice(0, 1);
  const previewClaims = claims.slice(0, 1);
  const previewEvidence = evidenceList.slice(0, 1);
  const summaryMarkdownComponents = useMemo(() => createMarkdownComponents("detail"), []);

  const renderOverview = () => {
    if (docLoading) {
      return (
        <Box sx={contentGridStyles}>
          <Box sx={sectionStackStyles}>
            {[0, 1, 2].map((idx) => (
              <Panel key={`overview-left-skeleton-${idx}`} eyebrow="Loading" title="Preparing panel">
                <Skeleton variant="text" width="45%" height={26} />
                <Skeleton variant="text" width="100%" height={18} />
                <Skeleton variant="text" width="92%" height={18} />
                <Skeleton variant="rounded" width="100%" height={80} sx={{ borderRadius: "12px" }} />
              </Panel>
            ))}
          </Box>
          <Box sx={sectionStackStyles}>
            {[0, 1].map((idx) => (
              <Panel key={`overview-right-skeleton-${idx}`} eyebrow="Loading" title="Preparing panel">
                <Skeleton variant="rounded" width="100%" height={220} sx={{ borderRadius: "12px" }} />
              </Panel>
            ))}
          </Box>
        </Box>
      );
    }

    if (docError) {
      return (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadDocument} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          }
          sx={alertStyles}
        >
          {docError}
        </Alert>
      );
    }

    if (!document) return null;

    return (
      <>
        <Box sx={contentGridStyles}>
          <Box sx={sectionStackStyles}>
            <Panel
              eyebrow="Summary"
              title="What this document appears to cover"
              meta={summaryText ? "Generated for this document" : "Generate when ready"}
            >
              <Box sx={summaryBoxStyles}>
                {summaryText ? (
                  <Box sx={markdownContainerStyles}>
                    <ReactMarkdown components={summaryMarkdownComponents}>{summaryText}</ReactMarkdown>
                  </Box>
                ) : (
                  <Typography sx={summaryTextStyles}>
                    No summary has been generated yet. Use the summarize action when you want a high-level understanding before reviewing citations, claims, or evidence.
                  </Typography>
                )}
              </Box>
            </Panel>

            <Panel eyebrow="Key Signals" title="What deserves attention first" meta="Prepared for fast review">
              <Box sx={listStackStyles}>
                {overviewSignals.map((signal) => (
                  <Box key={signal.title} sx={insightCardStyles}>
                    <Typography sx={insightTitleStyles}>{signal.title}</Typography>
                    <Typography sx={insightCopyStyles}>{signal.copy}</Typography>
                  </Box>
                ))}
              </Box>
            </Panel>

            <Panel eyebrow="Preview" title="Recent citations, claims, and evidence" meta="Top extracted results">
              <Box sx={listStackStyles}>
                {previewCitations.length > 0 ? (
                  previewCitations.map((citation) => (
                    <PreviewCard
                      key={`preview-citation-${citation.id}`}
                      title={citation.citation_text || citation.title || "Citation"}
                      copy={citation.context || citation.description || "Citation preview is available in the citations tab."}
                      chips={[
                        citation.citation_type || citation.type || null,
                        citation.confidence || citation.confidence_score || null,
                      ]}
                    />
                  ))
                ) : (
                  <EmptyInlineState
                    icon={<LibraryBooksOutlinedIcon sx={{ fontSize: 18 }} />}
                    title="No citations extracted yet"
                    copy="Run extraction or revisit OCR readiness before relying on citation analysis."
                  />
                )}

                {previewClaims.length > 0 ? (
                  previewClaims.map((claim) => (
                    <PreviewCard
                      key={`preview-claim-${claim.id || claim.claim_id}`}
                      title={claim.claim_text || "Claim"}
                      copy={claim.section || claim.context || "Claim preview is available in the claims tab."}
                      chips={[
                        claim.claim_type || null,
                        claim.claim_number != null ? `#${claim.claim_number}` : null,
                      ]}
                    />
                  ))
                ) : (
                  <EmptyInlineState
                    icon={<GavelIcon sx={{ fontSize: 18 }} />}
                    title="No claims segmented yet"
                    copy="Claims will appear here after the document has been segmented into usable legal propositions."
                  />
                )}

                {previewEvidence.length > 0 ? (
                  previewEvidence.map((evidence) => (
                    <PreviewCard
                      key={`preview-evidence-${evidence.id}`}
                      title={evidence.title || "Evidence excerpt"}
                      copy={evidence.content || evidence.text || evidence.passage || "-"}
                      chips={[
                        evidence.score || evidence.similarity ? `Score ${evidence.score || evidence.similarity}` : null,
                      ]}
                    />
                  ))
                ) : (
                  <EmptyInlineState
                    icon={<ManageSearchOutlinedIcon sx={{ fontSize: 18 }} />}
                    title="Evidence has not been loaded"
                    copy="Load evidence after claims are available to inspect supporting passages."
                  />
                )}
              </Box>
            </Panel>
          </Box>

          <Box sx={sectionStackStyles}>
            <Panel eyebrow="Metadata" title="File and processing details">
              <Box sx={listStackStyles}>
                {metadataRows.map((row) => (
                  <MetaRow key={row.label} label={row.label} value={row.value} />
                ))}
              </Box>
            </Panel>

            <Panel eyebrow="Workflow" title="Processing timeline" meta="Latest pipeline state">
              <Box sx={listStackStyles}>
                {timelineItems.map((item) => (
                  <TimelineRow key={`${item.title}-${item.time}`} item={item} />
                ))}
              </Box>
            </Panel>
          </Box>
        </Box>

        <Box sx={bottomGridStyles}>
          <Panel eyebrow="Suggested Actions" title="What the user should do next">
            <Box sx={listStackStyles}>
              <Box sx={insightCardStyles}>
                <Typography sx={insightTitleStyles}>Review citations before drafting</Typography>
                <Typography sx={insightCopyStyles}>
                  Open extracted authorities first if this document will be used in research, argument structure, or citation-backed drafting.
                </Typography>
              </Box>
              <Box sx={insightCardStyles}>
                <Typography sx={insightTitleStyles}>Compare claims with evidence</Typography>
                <Typography sx={insightCopyStyles}>
                  The strongest review flow is to validate extracted claims against retrieved supporting passages before trusting the analysis.
                </Typography>
              </Box>
              <Box sx={insightCardStyles}>
                <Typography sx={insightTitleStyles}>Generate a summary for faster triage</Typography>
                <Typography sx={insightCopyStyles}>
                  Summary is the quickest way to understand whether this document deserves deeper review or can be deferred.
                </Typography>
              </Box>
            </Box>
          </Panel>

          <Panel eyebrow="Raw Text" title="OCR preview" meta={document.has_ocr_text ? `${document.ocr_text_length?.toLocaleString?.() || document.ocr_text_length} characters` : "Unavailable"}>
            <Box sx={ocrPreviewStyles}>
              <Typography sx={ocrPreviewTextStyles}>
                {document.ocr_text || "OCR text is not available for this document yet."}
              </Typography>
            </Box>
          </Panel>
        </Box>
      </>
    );
  };

  const renderCitations = () => (
    <Panel eyebrow="Authorities" title="Extracted citations" meta={citationsLoading ? "Loading..." : `${citations.length} citation${citations.length === 1 ? "" : "s"} found`}>
      {citationsLoading ? (
        <Box sx={cardGridStyles}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={`citation-skel-${idx}`} variant="rounded" height={180} sx={{ borderRadius: "14px" }} />
          ))}
        </Box>
      ) : citationsError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadCitations} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          }
          sx={alertStyles}
        >
          {citationsError}
        </Alert>
      ) : citations.length === 0 ? (
        <EmptyPanelState
          title="No citations yet"
          copy="Run extraction to detect legal authorities for this document."
        />
      ) : (
        <Box sx={cardGridStyles}>
          {citations.map((citation) => (
            <CitationCard
              key={citation.id}
              citation={citation}
              onClick={() => navigate(`/citations/${citation.id}`)}
            />
          ))}
        </Box>
      )}
    </Panel>
  );

  const renderClaims = () => (
    <Panel eyebrow="Claims" title="Segmented legal propositions" meta={claimsLoading ? "Loading..." : `${claims.length} claim${claims.length === 1 ? "" : "s"} found`}>
      {claimsLoading ? (
        <Box sx={cardGridStyles}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={`claim-skel-${idx}`} variant="rounded" height={180} sx={{ borderRadius: "14px" }} />
          ))}
        </Box>
      ) : claimsError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadClaims} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          }
          sx={alertStyles}
        >
          {claimsError}
        </Alert>
      ) : claims.length === 0 ? (
        <EmptyPanelState
          title="No claims yet"
          copy="Run segmentation or continue processing before reviewing claims for this document."
        />
      ) : (
        <Box sx={cardGridStyles}>
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id || claim.claim_id}
              claim={claim}
              onClick={() => navigate(`/claims/${claim.id || claim.claim_id}`)}
            />
          ))}
        </Box>
      )}
    </Panel>
  );

  const renderEvidence = () => (
    <Panel eyebrow="Evidence" title="Supporting passages" meta={evidenceLoading ? "Loading..." : `${evidenceList.length} passage${evidenceList.length === 1 ? "" : "s"} loaded`}>
      {evidenceLoading ? (
        <Box sx={listStackStyles}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={`evidence-skel-${idx}`} variant="rounded" height={110} sx={{ borderRadius: "14px" }} />
          ))}
        </Box>
      ) : evidenceError ? (
        <Alert severity="error" sx={alertStyles}>
          {evidenceError}
        </Alert>
      ) : evidenceList.length === 0 ? (
        <EmptyPanelState
          title="No evidence loaded"
          copy="Load evidence after claims are available to inspect supporting passages for this document."
        />
      ) : (
        <Box sx={listStackStyles}>
          {evidenceList.map((evidence) => (
            <Box key={evidence.id || evidence.evidence_id || evidence.passage_id} sx={previewCardStyles}>
              <Typography sx={previewTitleStyles}>
                {evidence.title || `Evidence ${evidence.id || evidence.evidence_id || ""}`}
              </Typography>
              <Typography sx={previewCopyStyles}>
                {evidence.content || evidence.text || evidence.passage || "-"}
              </Typography>
              {(evidence.score || evidence.similarity) && (
                <Box sx={chipRowStyles}>
                  <Box sx={softChipStyles}>
                    Score {evidence.score || evidence.similarity}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Panel>
  );

  const renderRawText = () => (
    <Panel eyebrow="Raw Text" title="OCR text preview" meta={document?.ocr_text_length ? `${document.ocr_text_length.toLocaleString()} characters` : "Unavailable"}>
      {docLoading ? (
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: "14px" }} />
      ) : docError ? (
        <Alert severity="error" sx={alertStyles}>
          {docError}
        </Alert>
      ) : (
        <Box sx={{ ...ocrPreviewStyles, maxHeight: "none" }}>
          <Typography sx={ocrPreviewTextStyles}>
            {document?.ocr_text || "OCR text is not available for this document yet."}
          </Typography>
        </Box>
      )}
    </Panel>
  );

  return (
    <Box sx={pageShellStyles}>
      <Box sx={{ flexShrink: 0 }}>
        <Sidebar />
      </Box>

      <Box sx={mainShellStyles}>
        <Box sx={topbarStyles}>
          <Box>
            <Typography sx={eyebrowStyles}>Document Workspace</Typography>
            <Typography sx={pageTitleStyles}>Document Detail</Typography>
          </Box>

          <Box sx={topbarActionsStyles}>
            <Button onClick={() => navigate(ROUTES.DOCUMENTS)} startIcon={<ArrowBackIcon />} sx={ghostButtonStyles}>
              Back to Library
            </Button>
            <Button onClick={() => {
              loadDocument();
              loadCitations();
              loadClaims();
              loadClaimModelStatus();
              loadExistingEvidence().catch((err) => {
                logger.error("Failed to refresh stored evidence", err);
              });
            }} startIcon={<RefreshIcon />} sx={ghostButtonStyles}>
              Refresh
            </Button>
            <Button
              onClick={handleSummarize}
              disabled={!resolvedDocumentId || summaryLoading}
              startIcon={summaryLoading ? <CircularProgress size={16} color="inherit" /> : <SummarizeIcon />}
              sx={primaryButtonStyles}
            >
              {summaryLoading ? "Summarizing..." : "Generate Summary"}
            </Button>
            {claimModelStatus?.state !== "ready" && !claimModelStatus?.is_loaded && (
              <Button
                onClick={handleWarmClaimModel}
                disabled={claimModelWarmupPending || claimModelStatus?.state === "loading"}
                sx={ghostButtonStyles}
              >
                {claimModelWarmupPending || claimModelStatus?.state === "loading" ? "Warming Claim Model..." : "Warm Claim Model"}
              </Button>
            )}
          </Box>
        </Box>

        <Box sx={contentShellStyles}>
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              mb: 2,
              color: "var(--text-muted)",
              "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
            }}
          >
            <MuiLink
              component="button"
              onClick={() => navigate(ROUTES.DOCUMENTS)}
              underline="hover"
              sx={{ color: "var(--text-secondary)" }}
            >
              Documents
            </MuiLink>
            <Typography sx={{ color: "var(--text)" }}>{documentTitle}</Typography>
          </Breadcrumbs>

          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {claimModelStatusError && <Alert severity="error" sx={alertStyles}>{claimModelStatusError}</Alert>}
            {claimModelPresentation.tone === "warn" && (
              <Alert
                severity={claimModelStatus?.state === "error" ? "error" : "info"}
                sx={alertStyles}
                action={
                  claimModelStatus?.state !== "loading" && !claimModelStatus?.is_loaded ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={handleWarmClaimModel}
                      disabled={claimModelWarmupPending}
                    >
                      {claimModelWarmupPending ? "Starting..." : "Warm Up"}
                    </Button>
                  ) : null
                }
              >
                {claimModelPresentation.copy}
              </Alert>
            )}
            {actionError && <Alert severity="error" sx={alertStyles}>{actionError}</Alert>}
            {actionSuccess && <Alert severity="success" sx={alertStyles}>{actionSuccess}</Alert>}
            {extractError && <Alert severity="error" sx={alertStyles}>{extractError}</Alert>}
            {extractSuccess && <Alert severity="success" sx={alertStyles}>{extractSuccess}</Alert>}
            {summaryError && <Alert severity="error" sx={alertStyles}>{summaryError}</Alert>}
            {evidenceError && activeTab !== tabs.EVIDENCE && <Alert severity="error" sx={alertStyles}>{evidenceError}</Alert>}
          </Stack>

          <Box sx={heroGridStyles}>
            <Box sx={{ ...panelStyles, ...heroPanelStyles }}>
              <Box>
                <Typography sx={eyebrowStyles}>Active File</Typography>

                <Box sx={statusRowStyles}>
                  <StatusPill label={status.label} tone={status.tone} />
                  <StatusPill label={document?.file_type || document?.type || "Unknown"} tone="neutral" />
                  <StatusPill label={fileSizeDisplay} tone="neutral" />
                  <StatusPill label={`${citations.length} citation${citations.length === 1 ? "" : "s"}`} tone="neutral" />
                  <StatusPill label={claimModelPresentation.label} tone={claimModelPresentation.tone === "ok" ? "ok" : claimModelPresentation.tone === "warn" ? "warn" : "neutral"} />
                </Box>

                <Typography sx={heroTitleStyles}>{documentTitle}</Typography>
                <Typography sx={heroCopyStyles}>
                  {docLoading
                    ? "Loading document details..."
                    : status.summary}
                </Typography>
              </Box>

              <Box sx={heroActionRowStyles}>
                <Button
                  onClick={handleSummarize}
                  disabled={!resolvedDocumentId || summaryLoading}
                  sx={primaryButtonStyles}
                >
                  Summarize
                </Button>
                <Button
                  onClick={handleExtractCitations}
                  disabled={!resolvedDocumentId || citationExtracting || extracting}
                  sx={ghostButtonStyles}
                >
                  {citationExtracting ? "Extracting Citations..." : "Extract Citations"}
                </Button>
                <Button
                  onClick={handleSegmentClaims}
                  disabled={!resolvedDocumentId || claimSegmenting || extracting}
                  sx={ghostButtonStyles}
                >
                  {claimSegmenting ? "Segmenting Claims..." : "Segment Claims"}
                </Button>
                <Button
                  onClick={handleExtractText}
                  disabled={extracting || !resolvedDocumentId}
                  sx={ghostButtonStyles}
                >
                  {extracting ? "Extracting..." : "Extract Text Again"}
                </Button>
                <Button
                  onClick={handleLoadEvidence}
                  disabled={!resolvedDocumentId || evidenceLoading}
                  sx={ghostButtonStyles}
                >
                  {evidenceLoading ? "Loading Evidence..." : "Load Evidence"}
                </Button>
                {claimModelStatus?.state !== "ready" && !claimModelStatus?.is_loaded && (
                  <Button
                    onClick={handleWarmClaimModel}
                    disabled={claimModelWarmupPending || claimModelStatus?.state === "loading"}
                    sx={ghostButtonStyles}
                  >
                    {claimModelWarmupPending || claimModelStatus?.state === "loading" ? "Warming Model..." : "Warm Claim Model"}
                  </Button>
                )}
                <Button onClick={handleOpenRawText} sx={ghostButtonStyles}>
                  Raw Text
                </Button>
              </Box>
            </Box>

            <Box sx={metricGridStyles}>
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  sublabel={metric.sublabel}
                  tone={metric.tone}
                />
              ))}
            </Box>
          </Box>

          <Box sx={tabRowStyles}>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={tabsStyles}
            >
              <Tab label="Overview" value={tabs.OVERVIEW} />
              <Tab label="Citations" value={tabs.CITATIONS} />
              <Tab label="Claims" value={tabs.CLAIMS} />
              <Tab label="Evidence" value={tabs.EVIDENCE} />
              <Tab label="Raw Text" value={tabs.RAW_TEXT} />
            </Tabs>

            <Box sx={tabActionsStyles}>
              <Box sx={switchShellStyles}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={shortSummary}
                      onChange={(event) => setShortSummary(event.target.checked)}
                      size="small"
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: "var(--primary)" },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "var(--primary)" },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: "var(--text)", fontSize: "0.82rem" }}>Short summary</Typography>}
                />
              </Box>

              <Button onClick={handleSummarize} disabled={!resolvedDocumentId || summaryLoading} sx={primaryButtonStyles}>
                {summaryLoading ? "Working..." : "Summarize"}
              </Button>
              <Button onClick={handleExtractCitations} disabled={!resolvedDocumentId || citationExtracting || extracting} sx={ghostButtonStyles}>
                {citationExtracting ? "Working..." : "Extract Citations"}
              </Button>
              <Button onClick={handleSegmentClaims} disabled={!resolvedDocumentId || claimSegmenting || extracting} sx={ghostButtonStyles}>
                {claimSegmenting ? "Working..." : "Segment Claims"}
              </Button>
              <Button onClick={handleLoadEvidence} disabled={!resolvedDocumentId || evidenceLoading} sx={ghostButtonStyles}>
                {evidenceLoading ? "Working..." : "Load Evidence"}
              </Button>
              {claimModelStatus?.state !== "ready" && !claimModelStatus?.is_loaded && (
                <Button
                  onClick={handleWarmClaimModel}
                  disabled={claimModelWarmupPending || claimModelStatus?.state === "loading"}
                  sx={ghostButtonStyles}
                >
                  {claimModelWarmupPending || claimModelStatus?.state === "loading" ? "Warming..." : "Warm Claim Model"}
                </Button>
              )}
              <Button onClick={handleOpenRawText} sx={ghostButtonStyles}>
                Raw Text
              </Button>
            </Box>
          </Box>

          {activeTab === tabs.OVERVIEW && renderOverview()}
          {activeTab === tabs.CITATIONS && renderCitations()}
          {activeTab === tabs.CLAIMS && renderClaims()}
          {activeTab === tabs.EVIDENCE && renderEvidence()}
          {activeTab === tabs.RAW_TEXT && renderRawText()}
        </Box>
      </Box>
    </Box>
  );
}

function Panel({ eyebrow, title, meta, children }) {
  return (
    <Box sx={panelStyles}>
      <Box sx={panelHeaderStyles}>
        <Box>
          <Typography sx={eyebrowStyles}>{eyebrow}</Typography>
          <Typography sx={panelTitleStyles}>{title}</Typography>
        </Box>
        {meta ? <Typography sx={panelMetaStyles}>{meta}</Typography> : null}
      </Box>
      <Box sx={panelBodyStyles}>{children}</Box>
    </Box>
  );
}

function StatusPill({ label, tone }) {
  return <Box sx={{ ...statusPillStyles, ...(statusToneStyles[tone] || statusToneStyles.neutral) }}>{label}</Box>;
}

function MetricCard({ label, value, sublabel, tone = "default" }) {
  return (
    <Box sx={metricCardStyles}>
      <Typography sx={metricLabelStyles}>{label}</Typography>
      <Typography sx={metricValueStyles}>{value}</Typography>
      <Typography sx={{ ...metricSubStyles, ...(metricToneStyles[tone] || {}) }}>{sublabel}</Typography>
    </Box>
  );
}

function MetaRow({ label, value }) {
  return (
    <Box sx={metaRowStyles}>
      <Typography sx={metaKeyStyles}>{label}</Typography>
      <Typography sx={metaValueStyles}>{value || "-"}</Typography>
    </Box>
  );
}

function TimelineRow({ item }) {
  return (
    <Box sx={timelineRowStyles}>
      <Box sx={timelineDotStyles} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={timelineLabelStyles}>{item.title}</Typography>
        <Typography sx={timelineCopyStyles}>{item.copy}</Typography>
      </Box>
      <Typography sx={timelineTimeStyles}>{item.time}</Typography>
    </Box>
  );
}

function PreviewCard({ title, copy, chips = [] }) {
  return (
    <Box sx={previewCardStyles}>
      <Typography sx={previewTitleStyles}>{title}</Typography>
      <Typography sx={previewCopyStyles}>{copy}</Typography>
      {chips.filter(Boolean).length > 0 && (
        <Box sx={chipRowStyles}>
          {chips.filter(Boolean).map((chip) => (
            <Box key={`${title}-${chip}`} sx={softChipStyles}>
              {chip}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function EmptyInlineState({ icon, title, copy }) {
  return (
    <Box sx={inlineEmptyStyles}>
      <Box sx={inlineEmptyIconStyles}>{icon}</Box>
      <Box>
        <Typography sx={previewTitleStyles}>{title}</Typography>
        <Typography sx={previewCopyStyles}>{copy}</Typography>
      </Box>
    </Box>
  );
}

function EmptyPanelState({ title, copy }) {
  return (
    <Box sx={emptyPanelStyles}>
      <Box sx={emptyPanelIconStyles}>
        <AutoAwesomeIcon sx={{ color: "var(--primary)", fontSize: 28 }} />
      </Box>
      <Typography sx={emptyPanelTitleStyles}>{title}</Typography>
      <Typography sx={emptyPanelCopyStyles}>{copy}</Typography>
    </Box>
  );
}

function createMarkdownComponents(variant = "default") {
  const isDetail = variant === "detail";

  return {
    p: ({ node, ...props }) => (
      <Typography
        sx={{
          color: isDetail ? "var(--text-secondary)" : "text.primary",
          fontSize: isDetail ? "0.88rem" : "1rem",
          lineHeight: isDetail ? 1.8 : 1.9,
          mb: 1.2,
          "&:last-child": { mb: 0 },
        }}
        {...props}
      />
    ),
    h1: ({ node, ...props }) => (
      <Typography
        sx={{
          color: isDetail ? "var(--text)" : "text.primary",
          fontFamily: isDetail ? "var(--font-heading)" : "inherit",
          fontSize: isDetail ? "1.45rem" : "1.6rem",
          fontWeight: 700,
          mb: 1,
          mt: 0.4,
        }}
        {...props}
      />
    ),
    h2: ({ node, ...props }) => (
      <Typography
        sx={{
          color: isDetail ? "var(--text)" : "text.primary",
          fontFamily: isDetail ? "var(--font-heading)" : "inherit",
          fontSize: isDetail ? "1.2rem" : "1.3rem",
          fontWeight: 700,
          mb: 0.8,
          mt: 0.6,
        }}
        {...props}
      />
    ),
    h3: ({ node, ...props }) => (
      <Typography
        sx={{
          color: isDetail ? "var(--primary)" : "primary.main",
          fontSize: isDetail ? "0.74rem" : "0.85rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
          mb: 0.55,
          mt: 0.75,
        }}
        {...props}
      />
    ),
    ul: ({ node, ...props }) => <Box component="ul" sx={{ pl: 2.4, my: 1 }} {...props} />,
    ol: ({ node, ...props }) => <Box component="ol" sx={{ pl: 2.4, my: 1 }} {...props} />,
    li: ({ node, ...props }) => (
      <Typography
        component="li"
        sx={{
          color: isDetail ? "var(--text-secondary)" : "text.primary",
          fontSize: isDetail ? "0.86rem" : "0.98rem",
          lineHeight: 1.75,
          mb: 0.45,
        }}
        {...props}
      />
    ),
    strong: ({ node, ...props }) => (
      <Box component="strong" sx={{ color: isDetail ? "var(--text)" : "text.primary", fontWeight: 700 }} {...props} />
    ),
    blockquote: ({ node, ...props }) => (
      <Box
        component="blockquote"
        sx={{
          m: 0,
          my: 1,
          pl: 1.5,
          borderLeft: isDetail
            ? "2px solid rgba(var(--primary-rgb), 0.3)"
            : "3px solid rgba(76, 175, 80, 0.35)",
          color: isDetail ? "var(--text-secondary)" : "text.secondary",
        }}
        {...props}
      />
    ),
    code: ({ inline, node, ...props }) =>
      inline ? (
        <Box
          component="code"
          sx={{
            px: 0.55,
            py: 0.12,
            borderRadius: "6px",
            backgroundColor: isDetail ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            fontFamily: "monospace",
            fontSize: "0.84em",
          }}
          {...props}
        />
      ) : (
        <Box
          component="pre"
          sx={{
            m: 0,
            my: 1,
            p: 1.2,
            borderRadius: "12px",
            backgroundColor: isDetail ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.04)",
            overflowX: "auto",
          }}
        >
          <code {...props} />
        </Box>
      ),
  };
}

const pageShellStyles = {
  display: "flex",
  minHeight: "100vh",
  height: "100vh",
  backgroundColor: "var(--bg)",
  overflow: "hidden",
};

const mainShellStyles = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(127, 119, 221, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(127, 119, 221, 0.035) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    pointerEvents: "none",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    width: 540,
    height: 540,
    right: -140,
    bottom: -200,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(var(--primary-rgb), 0.14) 0%, transparent 70%)",
    pointerEvents: "none",
  },
};

const topbarStyles = {
  height: 58,
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  px: { xs: 2, md: 3 },
  py: 1.2,
  backdropFilter: "blur(8px)",
  backgroundColor: "rgba(26, 24, 20, 0.78)",
  position: "relative",
  zIndex: 1,
  flexWrap: "wrap",
};

const contentShellStyles = {
  flex: 1,
  overflow: "auto",
  px: { xs: 2, md: 3 },
  py: { xs: 2, md: 2.5 },
  position: "relative",
  zIndex: 1,
};

const eyebrowStyles = {
  color: "var(--text-muted)",
  fontSize: "0.62rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  mb: 0.35,
};

const pageTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: { xs: "1.55rem", md: "1.85rem" },
  lineHeight: 1,
};

const topbarActionsStyles = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "wrap",
};

const ghostButtonStyles = {
  minHeight: 36,
  px: 1.35,
  borderRadius: "10px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
};

const primaryButtonStyles = {
  minHeight: 36,
  px: 1.45,
  borderRadius: "10px",
  backgroundColor: "var(--primary)",
  color: "#fff",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
  boxShadow: "0 10px 20px rgba(var(--primary-rgb), 0.24)",
  "&:hover": { backgroundColor: "var(--primary-hover)" },
  "&.Mui-disabled": {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.4)",
  },
};

const alertStyles = {
  borderRadius: "14px",
  backgroundColor: "rgba(34, 32, 28, 0.96)",
  color: "var(--text)",
  border: "1px solid var(--border)",
};

const heroGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", xl: "1.25fr 0.75fr" },
  gap: 2,
  mb: 2,
};

const panelStyles = {
  background:
    "linear-gradient(180deg, rgba(var(--primary-rgb), 0.05) 0%, rgba(44, 42, 38, 0.98) 22%, rgba(44, 42, 38, 0.98) 100%)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle at top right, rgba(var(--primary-rgb), 0.12) 0%, transparent 36%)",
    pointerEvents: "none",
  },
};

const heroPanelStyles = {
  p: { xs: 2, md: 2.5 },
  minHeight: 250,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 2,
};

const statusRowStyles = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.7,
  mb: 1.2,
};

const statusPillStyles = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  px: 1,
  borderRadius: "999px",
  fontSize: "0.64rem",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  border: "1px solid transparent",
};

const statusToneStyles = {
  ok: {
    backgroundColor: "rgba(29, 158, 117, 0.12)",
    color: "#53c79d",
    borderColor: "rgba(29, 158, 117, 0.18)",
  },
  warn: {
    backgroundColor: "rgba(227, 168, 75, 0.12)",
    color: "#e3a84b",
    borderColor: "rgba(227, 168, 75, 0.18)",
  },
  neutral: {
    backgroundColor: "rgba(var(--primary-rgb), 0.12)",
    color: "var(--primary)",
    borderColor: "rgba(var(--primary-rgb), 0.2)",
  },
};

const heroTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: { xs: "2rem", md: "2.4rem" },
  lineHeight: 1.03,
  maxWidth: "18ch",
  mb: 1,
  wordBreak: "break-word",
};

const heroCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.94rem",
  lineHeight: 1.7,
  maxWidth: "62ch",
};

const heroActionRowStyles = {
  display: "flex",
  flexWrap: "wrap",
  gap: 1,
};

const metricGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
  gap: "1px",
  backgroundColor: "var(--border)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  overflow: "hidden",
  minHeight: 250,
};

const metricCardStyles = {
  backgroundColor: "var(--bg-secondary)",
  p: 2,
};

const metricLabelStyles = {
  color: "var(--text-muted)",
  fontSize: "0.62rem",
  letterSpacing: "0.17em",
  textTransform: "uppercase",
  mb: 0.7,
};

const metricValueStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "1.95rem",
  lineHeight: 1,
};

const metricSubStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.74rem",
  mt: 0.45,
};

const metricToneStyles = {
  good: { color: "#53c79d" },
  warn: { color: "#e3a84b" },
};

const tabRowStyles = {
  mb: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  flexWrap: "wrap",
};

const tabsStyles = {
  minHeight: "auto",
  "& .MuiTab-root": {
    minHeight: 40,
    px: 1.8,
    borderRadius: "999px",
    border: "1px solid var(--border)",
    backgroundColor: "rgba(var(--primary-rgb), 0.03)",
    color: "var(--text-secondary)",
    fontSize: "0.76rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    mr: 0.7,
  },
  "& .Mui-selected": {
    backgroundColor: "rgba(var(--primary-rgb), 0.12)",
    color: "var(--text) !important",
    borderColor: "rgba(var(--primary-rgb), 0.24)",
  },
  "& .MuiTabs-indicator": {
    display: "none",
  },
};

const tabActionsStyles = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "wrap",
};

const switchShellStyles = {
  minHeight: 40,
  px: 1.3,
  borderRadius: "10px",
  border: "1px solid var(--border)",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
};

const contentGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", xl: "1.15fr 0.85fr" },
  gap: 2,
  mb: 2,
};

const sectionStackStyles = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const panelHeaderStyles = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 2,
  p: { xs: 2, md: 2.2 },
  pb: 1.3,
  borderBottom: "1px solid var(--border)",
  position: "relative",
  zIndex: 1,
  flexWrap: "wrap",
};

const panelTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "1.45rem",
  lineHeight: 1,
};

const panelMetaStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.76rem",
};

const panelBodyStyles = {
  p: { xs: 2, md: 2.2 },
  position: "relative",
  zIndex: 1,
};

const summaryBoxStyles = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 2,
};

const summaryTextStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.88rem",
  lineHeight: 1.75,
  whiteSpace: "pre-wrap",
};

const markdownContainerStyles = {
  "& > *:last-child": {
    mb: 0,
  },
};

const listStackStyles = {
  display: "grid",
  gap: 1,
};

const insightCardStyles = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 1.5,
};

const insightTitleStyles = {
  color: "var(--text)",
  fontSize: "0.86rem",
  mb: 0.3,
};

const insightCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.78rem",
  lineHeight: 1.65,
};

const previewCardStyles = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 1.5,
};

const previewTitleStyles = {
  color: "var(--text)",
  fontSize: "0.84rem",
  mb: 0.25,
};

const previewCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.78rem",
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};

const chipRowStyles = {
  display: "flex",
  flexWrap: "wrap",
  gap: 0.5,
  mt: 0.8,
};

const softChipStyles = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  px: 0.9,
  border: "1px solid var(--border)",
  borderRadius: "999px",
  backgroundColor: "rgba(var(--primary-rgb), 0.04)",
  color: "var(--text-secondary)",
  fontSize: "0.64rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const inlineEmptyStyles = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 1,
  alignItems: "start",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 1.5,
};

const inlineEmptyIconStyles = {
  width: 36,
  height: 36,
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--primary)",
  backgroundColor: "rgba(var(--primary-rgb), 0.1)",
  border: "1px solid rgba(var(--primary-rgb), 0.18)",
};

const metaRowStyles = {
  display: "flex",
  justifyContent: "space-between",
  gap: 2,
  p: 1.4,
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
};

const metaKeyStyles = {
  color: "var(--text-muted)",
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const metaValueStyles = {
  color: "var(--text)",
  fontSize: "0.82rem",
  textAlign: "right",
  wordBreak: "break-word",
};

const timelineRowStyles = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  gap: 1.2,
  alignItems: "start",
  p: 1.4,
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
};

const timelineDotStyles = {
  width: 12,
  height: 12,
  mt: 0.5,
  borderRadius: "50%",
  backgroundColor: "var(--primary)",
  boxShadow: "0 0 0 5px rgba(var(--primary-rgb), 0.12)",
};

const timelineLabelStyles = {
  color: "var(--text)",
  fontSize: "0.82rem",
  mb: 0.25,
};

const timelineCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.75rem",
  lineHeight: 1.55,
};

const timelineTimeStyles = {
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  whiteSpace: "nowrap",
};

const bottomGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
  gap: 2,
};

const ocrPreviewStyles = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 2,
  maxHeight: 340,
  overflow: "auto",
};

const ocrPreviewTextStyles = {
  color: "var(--text-secondary)",
  fontFamily: "monospace",
  fontSize: "0.82rem",
  lineHeight: 1.75,
  whiteSpace: "pre-wrap",
};

const cardGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" },
  gap: 2,
};

const emptyPanelStyles = {
  border: "1px dashed var(--border)",
  borderRadius: "16px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: { xs: 3, md: 4 },
  display: "grid",
  justifyItems: "center",
  textAlign: "center",
  gap: 1,
};

const emptyPanelIconStyles = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(var(--primary-rgb), 0.08)",
};

const emptyPanelTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "1.35rem",
};

const emptyPanelCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.88rem",
  lineHeight: 1.7,
  maxWidth: "44ch",
};
