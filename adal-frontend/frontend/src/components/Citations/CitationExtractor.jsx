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
} from "@mui/material";
import AtlasButton from "../common/AtlasButton";
import citationApi from "../../api/citationApi";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import logger from "../../utils/logger";
import { getApiErrorMessage } from "../../utils/errorMessage";

export default function CitationExtractor({ documentId, onExtracted, disabled }) {
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState(null);

  const handleExtract = async () => {
    if (!documentId) {
      setError("Document ID is required");
      return;
    }

    setExtracting(true);
    setError(null);
    setSuccess(null);
    setShowDialog(false);

    try {
      const response = await citationApi.extractCitations(documentId);
      const data = response.data;

      setResult(data);
      setSuccess(
        `Successfully extracted ${data.total_citations || 0} citation${data.total_citations !== 1 ? "s" : ""}`
      );
      setShowDialog(true);

      // Callback to parent component
      if (onExtracted) {
        onExtracted(data);
      }
    } catch (err) {
      logger.error("Citation extraction error:", err);
      let errorMessage = "Failed to extract citations";
      
      if (err.response?.status === 404) {
        errorMessage = "Document not found. Please ensure the document exists and has OCR text.";
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.detail || "Document has no OCR text. Please extract text first.";
      } else {
        errorMessage = getApiErrorMessage(err, errorMessage);
      }

      setError(errorMessage);
    } finally {
      setExtracting(false);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

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
        <AtlasButton
          variant="contained"
          startIcon={extracting ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={handleExtract}
          disabled={disabled || extracting}
          loading={extracting}
          loadingPosition="start"
        >
          {extracting ? "Extracting..." : "Extract Citations"}
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

      {/* Results Dialog */}
      <Dialog
        open={showDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">Citations Extracted</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {result && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Successfully extracted <strong>{result.total_citations}</strong> citation
                {result.total_citations !== 1 ? "s" : ""} from the document.
              </Alert>
              {result.total_citations === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No citations were found in this document. This could mean:
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li>The document doesn't contain legal citations</li>
                    <li>The OCR text needs to be extracted first</li>
                    <li>The citation format is not recognized</li>
                  </ul>
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

