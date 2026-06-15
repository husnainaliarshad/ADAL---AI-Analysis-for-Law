import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  TablePagination,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SearchIcon from "@mui/icons-material/Search";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AppSidebar from "../../components/layout/Sidebar";
import { formatDate } from "../../utils/helpers";
import { PAGINATION, ROUTES } from "../../utils/constants";
import { fetchFiles, deleteFile } from "../../api/files";
import useDocumentUpdates from "../../hooks/useDocumentUpdates";
import logger from "../../utils/logger";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "ready", label: "OCR ready" },
  { value: "processing", label: "Processing" },
  { value: "attention", label: "Needs follow-up" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Filename A-Z" },
  { value: "size", label: "Largest first" },
  { value: "type", label: "Type" },
];

function formatFileSize(sizeMb) {
  const numeric = Number(sizeMb) || 0;
  return `${numeric.toFixed(2)} MB`;
}

function deriveDocumentStatus(file) {
  const statusSource = `${file?.processing_status || ""} ${file?.status || ""} ${file?.validation_status || ""}`.toLowerCase();

  if (statusSource.includes("fail") || statusSource.includes("error")) {
    return {
      key: "failed",
      label: "Failed",
      tone: "bad",
      summary: "OCR or extraction failed",
      attention: true,
    };
  }

  if (statusSource.includes("process") || statusSource.includes("pending")) {
    return {
      key: "processing",
      label: "Processing",
      tone: "pending",
      summary: "Still running extraction",
      attention: false,
    };
  }

  if (file?.has_ocr_text || Number(file?.ocr_text_length) > 0) {
    return {
      key: "ready",
      label: "OCR Ready",
      tone: "ok",
      summary: "Ready for summary and citations",
      attention: false,
    };
  }

  return {
    key: "attention",
    label: "Needs OCR",
    tone: "warn",
    summary: "No extracted text available yet",
    attention: true,
  };
}

function normalizeFile(file) {
  const id = file.id || file.document_id;
  const status = deriveDocumentStatus(file);
  const type = String(file.file_type || file.type || "unknown").toUpperCase();
  const size = Number(file.file_size_mb || file.size || 0);

  return {
    id,
    documentId: file.document_id || id,
    name: file.filename || file.name || `Document ${id}`,
    type,
    size,
    createdAt: file.created_at || null,
    hasOcrText: Boolean(file.has_ocr_text),
    ocrTextLength: Number(file.ocr_text_length || 0),
    status,
    raw: file,
  };
}

function compareDocuments(a, b, sortBy) {
  if (sortBy === "name") {
    return a.name.localeCompare(b.name);
  }

  if (sortBy === "size") {
    return b.size - a.size;
  }

  if (sortBy === "type") {
    return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
  }

  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

  if (sortBy === "oldest") {
    return dateA - dateB;
  }

  return dateB - dateA;
}

function StatusPill({ status }) {
  return <Box sx={{ ...statusPillStyles, ...statusToneStyles[status.tone] }}>{status.label}</Box>;
}

function StatCard({ label, value, sublabel, tone = "default" }) {
  return (
    <Box sx={statCardStyles}>
      <Typography sx={statLabelStyles}>{label}</Typography>
      <Typography sx={statValueStyles}>{value}</Typography>
      <Typography sx={{ ...statSubStyles, ...(statSubToneStyles[tone] || {}) }}>{sublabel}</Typography>
    </Box>
  );
}

function ToolbarField({ label, children, wide = false }) {
  return (
    <Box sx={{ ...toolbarFieldStyles, ...(wide ? toolbarWideFieldStyles : {}) }}>
      <Typography sx={toolbarLabelStyles}>{label}</Typography>
      {children}
    </Box>
  );
}

function FollowUpCard({ document, onOpen }) {
  return (
    <Box sx={followUpCardStyles}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={followUpTitleStyles}>{document.name}</Typography>
        <Typography sx={followUpCopyStyles}>{document.status.summary}</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <StatusPill status={document.status} />
        <Button onClick={() => onOpen(document.id)} sx={followUpActionStyles}>
          Review
        </Button>
      </Box>
    </Box>
  );
}

export default function DocumentList() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, document: null });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  const refresh = useCallback(async (isRetry = false) => {
    try {
      setLoading(true);
      setError(null);

      if (isRetry) {
        setRetryCount((prev) => prev + 1);
      }

      const response = await fetchFiles({ skip: 0, limit: 100 });
      const fileArray = Array.isArray(response?.files) ? response.files : [];
      setFiles(fileArray.map(normalizeFile));
      setRetryCount(0);
    } catch (err) {
      logger.error("Failed to fetch files:", err);

      let errorMessage = "Failed to load files";
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        errorMessage = "Request timed out. The server is taking too long to respond.";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (err.response?.status === 404) {
        errorMessage = "Files endpoint not found. Please check the API configuration.";
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { isConnected: isLiveConnected } = useDocumentUpdates((event) => {
    if (event?.type === "documents.updated") {
      refresh();
    }
  });

  useEffect(() => {
    setPage(0);
  }, [searchValue, statusFilter, sortBy, rowsPerPage]);

  const filteredFiles = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return files
      .filter((file) => {
        const matchesSearch =
          !query ||
          `${file.name} ${file.type} ${file.documentId}`.toLowerCase().includes(query);

        if (!matchesSearch) return false;

        if (statusFilter === "ready") return file.status.key === "ready";
        if (statusFilter === "processing") return file.status.key === "processing";
        if (statusFilter === "attention") return file.status.attention;

        return true;
      })
      .sort((a, b) => compareDocuments(a, b, sortBy));
  }, [files, searchValue, sortBy, statusFilter]);

  const paginatedFiles = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredFiles.slice(start, start + rowsPerPage);
  }, [filteredFiles, page, rowsPerPage]);

  const attentionFiles = useMemo(
    () => files.filter((file) => file.status.attention).slice(0, 4),
    [files],
  );

  const stats = useMemo(() => {
    const total = files.length;
    const ready = files.filter((file) => file.status.key === "ready").length;
    const processing = files.filter((file) => file.status.key === "processing").length;
    const attention = files.filter((file) => file.status.attention).length;
    const uploadedThisWeek = files.filter((file) => {
      if (!file.createdAt) return false;
      const createdAt = new Date(file.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;
      return Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    const readyPct = total > 0 ? Math.round((ready / total) * 100) : 0;

    return {
      total,
      ready,
      processing,
      attention,
      uploadedThisWeek,
      readyPct,
    };
  }, [files]);

  const handleOpenDocument = (docId) => {
    if (!docId) return;
    const num = Number(docId);
    if (Number.isNaN(num)) return;
    navigate(`/documents/${num}`);
  };

  const handleDeleteClick = (document, event) => {
    event.stopPropagation();
    setDeleteDialog({ open: true, document });
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, document: null });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteFile(deleteDialog.document.id);
      setDeleteDialog({ open: false, document: null });
      refresh();
    } catch (err) {
      logger.error("Failed to delete document:", err);
      setError(err.response?.data?.detail || "Failed to delete document");
    }
  };

  const clearFilters = () => {
    setSearchValue("");
    setStatusFilter("all");
    setSortBy("recent");
  };

  return (
    <Box sx={pageShellStyles}>
      <Box sx={{ flexShrink: 0 }}>
        <AppSidebar />
      </Box>

      <Box sx={mainShellStyles}>
        <Box sx={topbarStyles}>
          <Box>
            <Typography sx={eyebrowStyles}>Document Library</Typography>
            <Typography sx={pageTitleStyles}>Documents</Typography>
          </Box>

          <Box sx={topbarActionsStyles}>
            <Button onClick={() => refresh(true)} startIcon={<RefreshIcon />} sx={ghostActionButtonStyles}>
              Refresh
            </Button>
            <Button onClick={() => navigate(ROUTES.DOCUMENT_UPLOAD)} startIcon={<UploadFileIcon />} sx={primaryActionButtonStyles}>
              Upload Document
            </Button>
          </Box>
        </Box>

        <Box sx={contentStyles}>
          <Box sx={heroGridStyles}>
            <Box sx={{ ...panelStyles, ...heroPanelStyles }}>
              <Box>
                <Typography sx={heroTitleStyles}>
                  Keep every case file organized, <Box component="span" sx={{ color: "var(--primary)" }}>searchable</Box>, and ready for legal work.
                </Typography>
                <Typography sx={heroCopyStyles}>
                  Use this library to upload documents, check which files are OCR-ready, identify records that need attention, and open the right document before drafting, summarizing, or verifying citations.
                </Typography>
              </Box>

              <Box sx={heroActionsStyles}>
                <Button onClick={() => navigate(ROUTES.DOCUMENT_UPLOAD)} sx={heroPrimaryButtonStyles}>
                  Upload New File
                </Button>
                <Button onClick={() => setStatusFilter("attention")} sx={heroGhostButtonStyles}>
                  Review OCR Gaps
                </Button>
              </Box>
            </Box>

            <Box sx={statGridStyles}>
              <StatCard
                label="Total Documents"
                value={loading ? "..." : String(stats.total).padStart(2, "0")}
                sublabel={loading ? "Loading library" : `${stats.uploadedThisWeek} uploaded in the last 7 days`}
                tone="good"
              />
              <StatCard
                label="OCR Ready"
                value={loading ? "..." : String(stats.ready).padStart(2, "0")}
                sublabel={loading ? "Loading status" : `${stats.readyPct}% of library`}
                tone="good"
              />
              <StatCard
                label="Processing"
                value={loading ? "..." : String(stats.processing).padStart(2, "0")}
                sublabel={loading ? "Loading status" : `${stats.processing} active extraction jobs`}
                tone="warn"
              />
              <StatCard
                label="Flagged"
                value={loading ? "..." : String(stats.attention).padStart(2, "0")}
                sublabel={loading ? "Loading issues" : "OCR or extraction follow-up needed"}
                tone="bad"
              />
            </Box>
          </Box>

          <Box sx={toolbarGridStyles}>
            <ToolbarField label="Search" wide>
              <Box sx={searchInputShellStyles}>
                <SearchIcon sx={{ color: "var(--text-muted)", fontSize: 18 }} />
                <Box
                  component="input"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by filename, document ID, or type"
                  sx={toolbarInputStyles}
                />
              </Box>
            </ToolbarField>

            <ToolbarField label="Status">
              <Box component="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={toolbarSelectStyles}>
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Box>
            </ToolbarField>

            <ToolbarField label="Sort">
              <Box component="select" value={sortBy} onChange={(event) => setSortBy(event.target.value)} sx={toolbarSelectStyles}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Box>
            </ToolbarField>

            <Box sx={toolbarActionsRowStyles}>
              <Button onClick={clearFilters} sx={toolbarResetButtonStyles}>
                Clear Filters
              </Button>
            </Box>
          </Box>

          {error && !loading && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => refresh(true)}>
                  Retry
                </Button>
              }
              sx={errorAlertStyles}
            >
              {error}
              {retryCount > 0 && (
                <Typography component="div" sx={{ mt: 0.5, fontSize: "0.74rem", opacity: 0.84 }}>
                  Retry attempt: {retryCount}
                </Typography>
              )}
            </Alert>
          )}

          <Box sx={{ ...panelStyles, ...tablePanelStyles }}>
            <Box sx={tableHeadStyles}>
              <Box>
                <Typography sx={eyebrowStyles}>Library</Typography>
                <Typography sx={tableTitleStyles}>Recent and active documents</Typography>
              </Box>
              <Typography sx={tableMetaStyles}>
                {loading
                  ? "Loading documents..."
                  : `Showing ${paginatedFiles.length} of ${filteredFiles.length} matching documents${isLiveConnected ? " • Live updates on" : ""}`}
              </Typography>
            </Box>

            <Box sx={tableWrapStyles}>
              <Box component="table" sx={documentsTableStyles}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th">Document</Box>
                    <Box component="th">Type</Box>
                    <Box component="th">Size</Box>
                    <Box component="th">Status</Box>
                    <Box component="th">Created</Box>
                    <Box component="th" sx={{ textAlign: "right" }}>Actions</Box>
                  </Box>
                </Box>

                <Box component="tbody">
                  {loading &&
                    Array.from({ length: rowsPerPage }).map((_, index) => (
                      <Box component="tr" key={`loading-row-${index}`}>
                        <Box component="td">
                          <Box sx={docNameWrapStyles}>
                            <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: "10px" }} />
                            <Box sx={{ width: "100%" }}>
                              <Skeleton variant="text" width="60%" height={22} />
                              <Skeleton variant="text" width="42%" height={18} />
                            </Box>
                          </Box>
                        </Box>
                        <Box component="td"><Skeleton variant="text" width={56} /></Box>
                        <Box component="td"><Skeleton variant="text" width={68} /></Box>
                        <Box component="td"><Skeleton variant="rounded" width={96} height={28} /></Box>
                        <Box component="td"><Skeleton variant="text" width={92} /></Box>
                        <Box component="td" sx={{ textAlign: "right" }}>
                          <Skeleton variant="rounded" width={120} height={34} sx={{ ml: "auto" }} />
                        </Box>
                      </Box>
                    ))}

                  {!loading &&
                    paginatedFiles.map((file) => (
                      <Box
                        component="tr"
                        key={file.id}
                        onClick={() => handleOpenDocument(file.id)}
                        sx={documentRowStyles}
                      >
                        <Box component="td">
                          <Box sx={docNameWrapStyles}>
                            <Box sx={docIconStyles}>
                              <DescriptionOutlinedIcon sx={{ fontSize: 18, color: "inherit" }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={docTitleStyles}>{file.name}</Typography>
                              <Typography sx={docSubStyles}>
                                Document ID: {file.documentId}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Box component="td">
                          <Typography sx={tableBodyTextStyles}>{file.type}</Typography>
                        </Box>
                        <Box component="td">
                          <Typography sx={tableBodyTextStyles}>{formatFileSize(file.size)}</Typography>
                        </Box>
                        <Box component="td">
                          <StatusPill status={file.status} />
                        </Box>
                        <Box component="td">
                          <Typography sx={tableBodyTextStyles}>
                            {file.createdAt ? formatDate(file.createdAt) : "-"}
                          </Typography>
                        </Box>
                        <Box component="td" sx={{ textAlign: "right" }} onClick={(event) => event.stopPropagation()}>
                          <Box sx={rowActionWrapStyles}>
                            <IconButton onClick={() => handleOpenDocument(file.id)} sx={rowIconButtonStyles}>
                              <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton onClick={(event) => handleDeleteClick(file, event)} sx={rowDeleteButtonStyles}>
                              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                            <Button onClick={() => handleOpenDocument(file.id)} sx={rowTextButtonStyles}>
                              View
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                </Box>
              </Box>

              {!loading && !error && filteredFiles.length === 0 && (
                <Box sx={emptyCardStyles}>
                  <Box sx={emptyIconStyles}>
                    <DescriptionOutlinedIcon sx={{ fontSize: 30, color: "var(--primary)" }} />
                  </Box>
                  <Typography sx={emptyTitleStyles}>
                    {files.length === 0 ? "No documents yet" : "No documents match the current filters"}
                  </Typography>
                  <Typography sx={emptyCopyStyles}>
                    {files.length === 0
                      ? "Upload your first file to begin OCR, summaries, citations, and downstream legal analysis."
                      : "Try changing the search text, status filter, or sort order to broaden the result set."}
                  </Typography>
                  <Button
                    onClick={files.length === 0 ? () => navigate(ROUTES.DOCUMENT_UPLOAD) : clearFilters}
                    sx={heroPrimaryButtonStyles}
                  >
                    {files.length === 0 ? "Upload Document" : "Reset Filters"}
                  </Button>
                </Box>
              )}
            </Box>

            <TablePagination
              component="div"
              count={filteredFiles.length}
              page={page}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={PAGINATION.PAGE_SIZES}
              sx={paginationStyles}
            />
          </Box>

          <Box sx={secondaryGridStyles}>
            <Box sx={{ ...panelStyles, ...secondaryPanelStyles }}>
              <Box sx={tableHeadStyles}>
                <Box>
                  <Typography sx={eyebrowStyles}>Follow-Up</Typography>
                  <Typography sx={tableTitleStyles}>Files needing follow-up</Typography>
                </Box>
                <Typography sx={tableMetaStyles}>{loading ? "Loading..." : `${attentionFiles.length} visible issues`}</Typography>
              </Box>

              <Box sx={secondaryPanelContentStyles}>
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <Box key={`follow-up-loading-${index}`} sx={followUpCardStyles}>
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="55%" height={22} />
                        <Skeleton variant="text" width="72%" height={18} />
                      </Box>
                      <Skeleton variant="rounded" width={110} height={30} />
                    </Box>
                  ))
                ) : attentionFiles.length > 0 ? (
                  attentionFiles.map((file) => (
                    <FollowUpCard key={`follow-up-${file.id}`} document={file} onOpen={handleOpenDocument} />
                  ))
                ) : (
                  <Typography sx={secondaryEmptyTextStyles}>
                    No files currently need OCR follow-up. The library is clear for now.
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ ...panelStyles, ...secondaryPanelStyles }}>
              <Box sx={tableHeadStyles}>
                <Box>
                  <Typography sx={eyebrowStyles}>Empty State</Typography>
                  <Typography sx={tableTitleStyles}>When the library is empty</Typography>
                </Box>
              </Box>

              <Box sx={secondaryPanelContentStyles}>
                <Box sx={emptyStateCardStyles}>
                  <Typography sx={emptyStateTitleStyles}>No documents yet</Typography>
                  <Typography sx={emptyStateCopyStyles}>
                    Upload PDFs or images to start OCR extraction, legal summaries, citation detection, and document detail workflows.
                  </Typography>
                  <Button onClick={() => navigate(ROUTES.DOCUMENT_UPLOAD)} sx={heroPrimaryButtonStyles}>
                    Upload First Document
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
          },
        }}
      >
        <DialogTitle id="delete-dialog-title" sx={{ color: "#ffd0d0" }}>
          Delete Document
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "var(--text)", mb: 1 }}>
            Are you sure you want to delete "{deleteDialog.document?.name}"?
          </Typography>
          <Typography sx={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.65 }}>
            This action cannot be undone. The document and any derived data attached to it will be removed permanently.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleDeleteCancel} sx={dialogGhostButtonStyles}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} sx={dialogDangerButtonStyles}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
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
  overflow: "hidden",
  position: "relative",
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
    width: 520,
    height: 520,
    right: -180,
    bottom: -220,
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

const contentStyles = {
  flex: 1,
  overflow: "auto",
  px: { xs: 2, md: 3 },
  py: { xs: 2, md: 2.5 },
  position: "relative",
  zIndex: 1,
};

const heroGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", xl: "1.18fr 0.82fr" },
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
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 2,
};

const heroTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: { xs: "2rem", md: "2.45rem" },
  lineHeight: 1.03,
  maxWidth: "14ch",
  mb: 1,
};

const heroCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.94rem",
  lineHeight: 1.7,
  maxWidth: "58ch",
};

const heroActionsStyles = {
  display: "flex",
  flexWrap: "wrap",
  gap: 1,
};

const statGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
  gap: "1px",
  backgroundColor: "var(--border)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  overflow: "hidden",
  minHeight: 220,
};

const statCardStyles = {
  backgroundColor: "var(--bg-secondary)",
  p: 2,
};

const statLabelStyles = {
  color: "var(--text-muted)",
  fontSize: "0.62rem",
  letterSpacing: "0.17em",
  textTransform: "uppercase",
  mb: 0.7,
};

const statValueStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "2rem",
  lineHeight: 1,
};

const statSubStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.74rem",
  mt: 0.45,
};

const statSubToneStyles = {
  good: { color: "#53c79d" },
  warn: { color: "#e3a84b" },
  bad: { color: "#e67a7a" },
};

const toolbarGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.7fr 0.7fr auto" },
  gap: 1.2,
  alignItems: "end",
  mb: 2,
};

const toolbarFieldStyles = {
  border: "1px solid var(--border)",
  borderRadius: "14px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 1.1,
};

const toolbarWideFieldStyles = {
  minWidth: 0,
};

const toolbarLabelStyles = {
  color: "var(--text-muted)",
  fontSize: "0.62rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  mb: 0.6,
};

const searchInputShellStyles = {
  minHeight: 44,
  border: "1px solid var(--border)",
  borderRadius: "10px",
  backgroundColor: "var(--bg-secondary)",
  display: "flex",
  alignItems: "center",
  gap: 1,
  px: 1.1,
};

const toolbarInputStyles = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  color: "var(--text)",
  fontSize: "0.84rem",
  "&::placeholder": {
    color: "var(--text-muted)",
    opacity: 1,
  },
};

const toolbarSelectStyles = {
  width: "100%",
  minHeight: 44,
  border: "1px solid var(--border)",
  borderRadius: "10px",
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text)",
  px: 1.1,
  fontSize: "0.84rem",
  outline: "none",
};

const toolbarActionsRowStyles = {
  display: "flex",
  justifyContent: { xs: "stretch", lg: "flex-end" },
  alignItems: "center",
  gap: 1,
};

const toolbarResetButtonStyles = {
  minHeight: 38,
  borderRadius: "10px",
  px: 1.4,
  border: "1px solid var(--border)",
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
};

const heroPrimaryButtonStyles = {
  minHeight: 38,
  px: 1.5,
  borderRadius: "10px",
  backgroundColor: "var(--primary)",
  color: "#fff",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.74rem",
  boxShadow: "0 10px 20px rgba(var(--primary-rgb), 0.24)",
  "&:hover": {
    backgroundColor: "var(--primary-hover)",
  },
};

const heroGhostButtonStyles = {
  minHeight: 38,
  px: 1.4,
  borderRadius: "10px",
  border: "1px solid var(--border)",
  backgroundColor: "rgba(255,255,255,0.03)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
};

const ghostActionButtonStyles = {
  minHeight: 36,
  px: 1.3,
  borderRadius: "10px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
};

const primaryActionButtonStyles = {
  minHeight: 36,
  px: 1.4,
  borderRadius: "10px",
  backgroundColor: "var(--primary)",
  color: "#fff",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
  "&:hover": {
    backgroundColor: "var(--primary-hover)",
  },
};

const topbarActionsStyles = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "wrap",
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
  fontSize: { xs: "1.6rem", md: "1.9rem" },
  lineHeight: 1,
};

const errorAlertStyles = {
  mb: 2,
  borderRadius: "14px",
  backgroundColor: "rgba(120, 30, 30, 0.22)",
  color: "#ffdede",
  border: "1px solid rgba(255, 120, 120, 0.2)",
};

const tablePanelStyles = {
  p: 0,
  mb: 2,
};

const tableHeadStyles = {
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

const tableTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "1.45rem",
  lineHeight: 1,
};

const tableMetaStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.76rem",
};

const tableWrapStyles = {
  px: { xs: 2, md: 2.2 },
  pb: 2,
  overflowX: "auto",
};

const documentsTableStyles = {
  width: "100%",
  minWidth: 860,
  borderCollapse: "collapse",
  "& th": {
    textAlign: "left",
    py: 1,
    px: 0.5,
    borderBottom: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontSize: "0.64rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 500,
  },
  "& td": {
    py: 1.25,
    px: 0.5,
    borderBottom: "1px solid var(--border)",
    color: "var(--text-secondary)",
    verticalAlign: "middle",
  },
  "& th:first-of-type, & td:first-of-type": {
    pl: 0,
  },
  "& th:last-of-type, & td:last-of-type": {
    pr: 0,
  },
};

const documentRowStyles = {
  cursor: "pointer",
  transition: "background-color 0.18s ease, transform 0.18s ease",
  "&:hover": {
    backgroundColor: "rgba(var(--primary-rgb), 0.05)",
    transform: "translateX(2px)",
  },
};

const docNameWrapStyles = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  minWidth: 0,
};

const docIconStyles = {
  width: 36,
  height: 36,
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--primary)",
  backgroundColor: "rgba(var(--primary-rgb), 0.1)",
  border: "1px solid rgba(var(--primary-rgb), 0.18)",
  flexShrink: 0,
};

const docTitleStyles = {
  color: "var(--text)",
  fontSize: "0.86rem",
  mb: 0.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const docSubStyles = {
  color: "var(--text-muted)",
  fontSize: "0.7rem",
};

const tableBodyTextStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.8rem",
};

const statusPillStyles = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  px: 1,
  borderRadius: "999px",
  fontSize: "0.68rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const statusToneStyles = {
  ok: {
    backgroundColor: "rgba(29, 158, 117, 0.12)",
    color: "#53c79d",
    borderColor: "rgba(29, 158, 117, 0.18)",
  },
  pending: {
    backgroundColor: "rgba(var(--primary-rgb), 0.12)",
    color: "var(--primary)",
    borderColor: "rgba(var(--primary-rgb), 0.18)",
  },
  warn: {
    backgroundColor: "rgba(227, 168, 75, 0.12)",
    color: "#e3a84b",
    borderColor: "rgba(227, 168, 75, 0.18)",
  },
  bad: {
    backgroundColor: "rgba(226, 75, 74, 0.12)",
    color: "#e67a7a",
    borderColor: "rgba(226, 75, 74, 0.18)",
  },
};

const rowActionWrapStyles = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 0.8,
};

const rowIconButtonStyles = {
  color: "var(--primary)",
  border: "1px solid rgba(var(--primary-rgb), 0.18)",
  backgroundColor: "rgba(var(--primary-rgb), 0.08)",
  width: 32,
  height: 32,
};

const rowDeleteButtonStyles = {
  color: "#f0a5a5",
  border: "1px solid rgba(226, 75, 74, 0.18)",
  backgroundColor: "rgba(226, 75, 74, 0.08)",
  width: 32,
  height: 32,
};

const rowTextButtonStyles = {
  minHeight: 32,
  borderRadius: "8px",
  border: "1px solid var(--border)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.68rem",
  px: 1.15,
};

const emptyCardStyles = {
  display: "grid",
  justifyItems: "center",
  textAlign: "center",
  gap: 1.1,
  border: "1px dashed var(--border)",
  borderRadius: "16px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  maxWidth: 520,
  mx: "auto",
  mt: 2,
  p: { xs: 3, md: 4 },
};

const emptyIconStyles = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(var(--primary-rgb), 0.08)",
};

const emptyTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "1.45rem",
};

const emptyCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.9rem",
  lineHeight: 1.7,
  maxWidth: "46ch",
};

const secondaryGridStyles = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", xl: "1fr 0.92fr" },
  gap: 2,
  pb: 1,
};

const secondaryPanelStyles = {
  minHeight: 260,
};

const secondaryPanelContentStyles = {
  position: "relative",
  zIndex: 1,
  p: { xs: 2, md: 2.2 },
  display: "grid",
  gap: 1,
};

const followUpCardStyles = {
  border: "1px solid var(--border)",
  borderRadius: "14px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 1.25,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 1.2,
  flexWrap: "wrap",
};

const followUpTitleStyles = {
  color: "var(--text)",
  fontSize: "0.86rem",
  mb: 0.2,
};

const followUpCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.76rem",
  lineHeight: 1.6,
};

const followUpActionStyles = {
  minHeight: 30,
  borderRadius: "8px",
  border: "1px solid var(--border)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.66rem",
  px: 1.1,
};

const secondaryEmptyTextStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.84rem",
  lineHeight: 1.7,
};

const emptyStateCardStyles = {
  border: "1px dashed var(--border)",
  borderRadius: "16px",
  backgroundColor: "rgba(var(--primary-rgb), 0.03)",
  p: 2,
  display: "grid",
  gap: 1,
  justifyItems: "flex-start",
};

const emptyStateTitleStyles = {
  color: "var(--text)",
  fontFamily: "var(--font-heading)",
  fontSize: "1.35rem",
};

const emptyStateCopyStyles = {
  color: "var(--text-secondary)",
  fontSize: "0.84rem",
  lineHeight: 1.7,
  maxWidth: "44ch",
};

const paginationStyles = {
  borderTop: "1px solid var(--border)",
  color: "var(--text-secondary)",
  position: "relative",
  zIndex: 1,
  "& .MuiTablePagination-toolbar": {
    px: { xs: 2, md: 2.2 },
  },
  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows, & .MuiTablePagination-select": {
    color: "var(--text-secondary)",
    fontSize: "0.78rem",
  },
  "& .MuiIconButton-root": {
    color: "var(--text)",
  },
};

const dialogGhostButtonStyles = {
  borderRadius: "10px",
  border: "1px solid var(--border)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
  px: 1.3,
};

const dialogDangerButtonStyles = {
  borderRadius: "10px",
  backgroundColor: "#a83e3e",
  color: "#fff",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "0.72rem",
  px: 1.4,
  "&:hover": {
    backgroundColor: "#913434",
  },
};
