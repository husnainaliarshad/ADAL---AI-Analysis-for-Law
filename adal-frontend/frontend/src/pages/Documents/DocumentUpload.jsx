import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  IconButton,
  LinearProgress,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import AtlasButton from "../../components/common/AtlasButton";
import AppSidebar from "../../components/layout/Sidebar";
import { formatBytes, isAllowedFile } from "../../utils/helpers";
import { UPLOAD, ROUTES } from "../../utils/constants";
import axiosClient from "../../api/axiosClient";
import { getApiErrorMessage } from "../../utils/errorMessage";
import logger from "../../utils/logger";

export default function DocumentUpload() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [overflowCount, setOverflowCount] = useState(0);
  
  // Configuration for parallel uploads
  const CONCURRENT_UPLOADS = 3; // Upload 3 files simultaneously
  const UPLOAD_TIMEOUT = 120000; // 2 minutes timeout for file uploads

  const onFiles = useCallback((fileList) => {
    const accepted = [];
    let rejected = 0;

    Array.from(fileList).forEach((f) => {
      const res = isAllowedFile(f);
      if (!res.ok) {
        rejected += 1;
        return;
      }
      accepted.push({
        file: f,
        id: `${f.name}-${f.size}-${f.lastModified}`,
        progress: 0,
        status: "pending",
        error: null,
      });
    });

    setRejectedCount((c) => c + rejected);

    setFiles((prev) => {
      const existingIds = new Set(prev.map((x) => x.id));
      const deduped = accepted.filter((n) => !existingIds.has(n.id));
      const capacity = Math.max(0, UPLOAD.MAX_FILES - prev.length);
      const limited = deduped.slice(0, capacity);
      const overflow = Math.max(0, deduped.length - limited.length);
      setOverflowCount((o) => o + overflow);
      return [...prev, ...limited];
    });
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  const onPick = useCallback(
    (e) => {
      if (e.target?.files?.length) onFiles(e.target.files);
    },
    [onFiles]
  );

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => setFiles([]);

  const canUpload = files.length > 0 && !uploading;

  // Calculate overall upload progress
  const calculateOverallProgress = (fileList) => {
    if (fileList.length === 0) return 0;
    const totalProgress = fileList.reduce((sum, f) => sum + (f.progress || 0), 0);
    return Math.round(totalProgress / fileList.length);
  };

  // Upload a single file
  const uploadSingleFile = async (fileObj, index) => {
    // Update status to uploading
    setFiles((prev) =>
      prev.map((f, idx) =>
        idx === index ? { ...f, status: "uploading", progress: 0 } : f
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", fileObj.file);

      await axiosClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: UPLOAD_TIMEOUT, // 2 minutes for uploads
        onUploadProgress: (e) => {
          const progress = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          setFiles((prev) => {
            const updated = prev.map((f, idx) => (idx === index ? { ...f, progress } : f));
            // Update overall progress
            setOverallProgress(calculateOverallProgress(updated));
            return updated;
          });
        },
      });

      setFiles((prev) => {
        const updated = prev.map((f, idx) =>
          idx === index ? { ...f, status: "done", progress: 100 } : f
        );
      setOverallProgress(calculateOverallProgress(updated));
        return updated;
      });

      return { success: true, index };
    } catch (error) {
      logger.error("Upload error:", error);
      let errorMessage = getApiErrorMessage(error, "Upload failed");
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Upload timed out. File may be too large or server is slow.";
      }

      setFiles((prev) => {
        const updated = prev.map((f, idx) =>
          idx === index
            ? {
                ...f,
                status: "error",
                error: errorMessage,
              }
            : f
        );
        setOverallProgress(calculateOverallProgress(updated));
        return updated;
      });

      return { success: false, index, error: errorMessage };
    }
  };

  // Process uploads in batches (parallel with concurrency limit)
  const processBatch = async (batch, batchIndex) => {
    const uploadPromises = batch.map((fileObj, batchItemIndex) => {
      const globalIndex = batchIndex * CONCURRENT_UPLOADS + batchItemIndex;
      return uploadSingleFile(fileObj, globalIndex);
    });

    return Promise.allSettled(uploadPromises);
  };

  const uploadDocuments = async () => {
    setUploading(true);
    setOverallProgress(0);

    // Split files into batches for parallel upload
    const batches = [];
    for (let i = 0; i < files.length; i += CONCURRENT_UPLOADS) {
      batches.push(files.slice(i, i + CONCURRENT_UPLOADS));
    }

    // Process batches sequentially, but files within each batch in parallel
    let hasSuccessfulUpload = false;
    for (let i = 0; i < batches.length; i++) {
      const results = await processBatch(batches[i], i);
      
      // Check if any uploads in this batch succeeded
      // Promise.allSettled returns { status: 'fulfilled'|'rejected', value?: {...}, reason?: Error }
      const batchHasSuccess = results.some((result) => {
        if (result.status === 'fulfilled') {
          return result.value && result.value.success === true;
        }
        return false;
      });
      
      if (batchHasSuccess) {
        hasSuccessfulUpload = true;
      }
    }

    setUploading(false);

    // Navigate to documents page immediately if at least one file uploaded successfully
    if (hasSuccessfulUpload) {
      logger.debug('[DocumentUpload] Successful upload detected, navigating to documents page');
      navigate(ROUTES.DOCUMENTS);
    } else {
      logger.debug('[DocumentUpload] No successful uploads detected, not navigating');
    }
  };

  const dropStyles = useMemo(
    () => ({
      border: `2px dashed ${theme.palette.divider}`,
      background: theme.palette.background.paper,
      borderRadius: "var(--radius-l)",
      padding: theme.spacing(4),
      textAlign: "center",
      cursor: "pointer",
      transition: "background 150ms ease, border-color 150ms ease",
      "&:hover": {
        background:
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.02)"
            : "rgba(0,0,0,0.02)",
        borderColor: theme.palette.primary.main,
      },
    }),
    [theme]
  );

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      backgroundColor: 'var(--bg)',
      overflow: 'hidden'
    }}>
      {/* Sidebar - First child, fixed width */}
      <Box sx={{ flexShrink: 0 }}>
        <AppSidebar />
      </Box>

      {/* Main Upload Area - Second child, takes remaining space */}
      <Box sx={{ 
        flexGrow: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden'
      }}>
        {/* Header Section */}
        <Box sx={{ 
          p: 3, 
          borderBottom: `1px solid var(--border)`,
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontFamily: 'var(--font-heading)',
              color: 'var(--text)',
              mb: 1
            }}
          >
            Upload Documents
          </Typography>
          <Typography 
            variant="body2" 
            color="var(--text-muted)"
            sx={{ fontFamily: 'var(--font-body)' }}
          >
            Add PDFs or images. Metadata and advanced processing options will be enabled when backend support is available.
          </Typography>
        </Box>

        {/* Content - Scrollable middle section */}
        <Box sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          p: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Card>
            <CardContent>
              {/* Dropzone */}
              <Box onDrop={onDrop} onDragOver={(e) => e.preventDefault()} sx={dropStyles} component="label">
                <CloudUploadIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  Drag & drop files here
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  or click to browse files
                </Typography>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*,.md,.markdown,.txt"
                  hidden
                  onChange={onPick}
                  data-testid="file-input"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Allowed: PDF, images, Markdown (.md, .markdown), Text (.txt) • Max per file: {UPLOAD.MAX_UPLOAD_MB} MB • Up to {UPLOAD.MAX_FILES} files
                </Typography>
              </Box>

              {/* Overall Progress Bar */}
              {uploading && (
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      Overall Progress:
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={overallProgress} 
                      sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50, textAlign: "right" }}>
                      {overallProgress}%
                </Typography>
              </Stack>
            </Box>
          )}

          {/* File list */}
          <Box sx={{ mt: 2 }}>
            {files.map((f) => (
              <Card key={f.id} sx={{ mb: 1 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 500 }}>
                        {f.file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatBytes(f.file.size)}
                      </Typography>
                      {f.status === "error" && f.error && (
                        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                          {f.error}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {f.status === "uploading" && (
                        <Box sx={{ width: 120 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={f.progress} 
                            sx={{ height: 6, borderRadius: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 0.5 }}>
                            {f.progress}%
                          </Typography>
                        </Box>
                      )}
                      {f.status === "done" && <CheckCircleIcon color="success" />}
                      {f.status === "error" && <ErrorOutlineIcon color="error" />}
                      <IconButton 
                        size="small" 
                        onClick={() => removeFile(f.id)}
                        disabled={uploading && f.status === "uploading"}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Actions */}
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <AtlasButton variant="contained" onClick={uploadDocuments} disabled={!canUpload} loading={uploading}>
              Upload
            </AtlasButton>
            <AtlasButton variant="outlined" onClick={clearAll} disabled={uploading || files.length === 0}>
              Clear
            </AtlasButton>
          </Stack>

          {/* Rejected / overflow counts */}
          {(rejectedCount > 0 || overflowCount > 0) && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
              {rejectedCount > 0 && `${rejectedCount} file(s) rejected due to invalid type or size.`}
              {overflowCount > 0 && ` ${overflowCount} file(s) could not be added due to upload limit.`}
            </Typography>
          )}
        </CardContent>
      </Card>
        </Box>
      </Box>
    </Box>
  );
}
