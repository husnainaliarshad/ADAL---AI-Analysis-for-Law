import React, { useState, useEffect } from "react";
import {
  Box,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  FormControlLabel,
  Switch,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AtlasButton from "../common/AtlasButton";
import claimApi from "../../api/claimApi";
import logger from "../../utils/logger";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function ClaimSegmenter({ documentId, onSegmented, disabled }) {
  const [segmenting, setSegmenting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState(null);
  const [useCitationGuidance, setUseCitationGuidance] = useState(true);

  const handleSegment = async () => {
    if (!documentId) {
      setError("Document ID is required");
      return;
    }
    setSegmenting(true);
    setError(null);
    setSuccess(null);
    setShowDialog(false);

    try {
      const res = await claimApi.segmentClaims(documentId, useCitationGuidance);
      const data = res?.data || {};
      setResult(data);
      const total = data.total_claims ?? data.count ?? 0;
      setSuccess(`Segmented ${total} claim${total === 1 ? "" : "s"}.`);
      setShowDialog(true);
      if (onSegmented) onSegmented(data);
    } catch (err) {
      logger.error("Claim segmentation error:", err);
      let msg = "Failed to segment claims";
      if (err.response?.status === 404) msg = "Document not found or not ready for segmentation.";
      else if (err.response?.status === 400) msg = err.response?.data?.detail || "Document lacks OCR text.";
      else msg = getApiErrorMessage(err, msg);
      setError(msg);
    } finally {
      setSegmenting(false);
    }
  };

  const handleCloseDialog = () => setShowDialog(false);

  // Auto-dismiss success alerts after 2.5 seconds (error alerts stay visible)
  useEffect(() => {
    if (success && !showDialog) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success, showDialog]);

  return (
    <>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={useCitationGuidance}
                onChange={(e) => setUseCitationGuidance(e.target.checked)}
                disabled={segmenting || disabled}
              />
            }
            label="Use citation guidance"
          />
        </Box>

        <AtlasButton
          variant="contained"
          startIcon={segmenting ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={handleSegment}
          disabled={disabled || segmenting}
          loading={segmenting}
          loadingPosition="start"
        >
          {segmenting ? "Segmenting..." : "Segment Claims"}
        </AtlasButton>

        {error && (
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            sx={{ mt: 2 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {success && !showDialog && (
          <Alert
            severity="success"
            icon={<CheckCircleIcon />}
            sx={{ mt: 2 }}
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        )}
      </Box>

      <Dialog open={showDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">Claims Segmented</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {result && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                {success || "Segmentation completed."}
              </Alert>
              {result.total_claims === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No claims were detected. Ensure the document has OCR text and relevant content.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <AtlasButton onClick={handleCloseDialog} variant="contained">
            Close
          </AtlasButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

