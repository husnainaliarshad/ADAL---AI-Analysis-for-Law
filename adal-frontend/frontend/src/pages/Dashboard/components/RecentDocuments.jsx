/**
 * RecentDocuments Component
 * Displays a table of recent documents with actions (view, download, delete)
 * 
 * @param {Array} rows - Array of document objects with id, name, uploadDate, status
 * @param {Function} formatDate - Function to format date strings
 * @param {Function} onRefresh - Callback function to refresh the document list
 */
import React, { useState } from "react";
import { Card, CardContent, Divider, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Tooltip, Stack, Chip, Box, alpha, useTheme, Link, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../utils/constants";
import documentApi from "../../../api/documentApi";
import logger from "../../../utils/logger";

/**
 * StatusChip Component
 * Displays a status chip with appropriate color based on status
 * 
 * @param {string} status - Document status ('completed', 'processing', 'error', 'pending')
 */
function StatusChip({ status }) {
  const map = {
    completed: { label: 'Completed', palette: 'primary' },
    processing: { label: 'Processing', palette: 'warning' },
    error: { label: 'Error', palette: 'error' },
    pending: { label: 'Pending', palette: 'warning' },
  }
  const item = map[status] || { label: String(status || 'Unknown'), palette: 'default' }

  // Use filled chip with white text for maximum contrast across themes
  return (
    <Chip
      size="small"
      label={item.label}
      variant="filled"
      sx={(theme) => ({
        bgcolor:
          item.palette !== 'default'
            ? theme.palette[item.palette].main
            : theme.palette.mode === 'dark'
            ? theme.palette.grey[700]
            : theme.palette.grey[600],
        color: theme.palette.common.white,
        fontWeight: 600,
        '& .MuiChip-label': {
          color: `${theme.palette.common.white} !important`,
          fontWeight: 700,
        },
      })}
    />
  )
}

export default function RecentDocuments({ rows = [], formatDate, onRefresh }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const accentMain = theme.palette.primary.main;
  const accentStrong = theme.palette.primary.dark || theme.palette.primary.main;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleViewDocument = (documentId) => {
    navigate(`${ROUTES.DOCUMENTS}/${documentId}`);
  };

  const handleViewAll = () => {
    navigate(ROUTES.DOCUMENTS);
  };

  const handleDownload = async (documentId, filename) => {
    if (isDownloading) return;
    
    setIsDownloading(true);
    try {
      const response = await documentApi.downloadDocument(documentId);
      
      if (!response?.data) {
        throw new Error('No data received from server');
      }
      
      // response.data is already a Blob when responseType: 'blob' is set
      const blob = response.data;
      
      if (!(blob instanceof Blob)) {
        throw new Error('Invalid file data received');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 100);
      
      logger.debug(`Downloaded: ${filename}`);
    } catch (error) {
      logger.error('Download failed:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      alert(`Failed to download ${filename}: ${errorMessage}. Please try again.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteClick = (documentId, filename) => {
    setDocumentToDelete({ id: documentId, name: filename });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await documentApi.deleteDocument(documentToDelete.id);
      
      // Close dialog
      setDeleteDialogOpen(false);
      const deletedName = documentToDelete.name;
      setDocumentToDelete(null);
      
      // Refresh the document list
      if (onRefresh) {
        onRefresh();
      }
      
      logger.debug(`Deleted: ${deletedName}`);
    } catch (error) {
      logger.error('Delete failed:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      alert(`Failed to delete ${documentToDelete?.name || 'document'}: ${errorMessage}. Please try again.`);
      // Keep dialog open on error so user can retry
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.12)}`,
        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.06)}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 22%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${alpha(accentMain, 0.9)} 38%, transparent 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Box sx={{ display: "grid", gap: 0.25 }}>
            <Typography
              sx={{
                fontSize: "0.68rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "text.secondary",
                fontWeight: 600,
              }}
            >
              Documents
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.1rem", md: "1.25rem" },
              }}
            >
              Recent Documents
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: "0.8rem",
                lineHeight: 1.6,
              }}
            >
              The latest uploaded files and their current workspace status.
            </Typography>
          </Box>
          <Link
            component="button"
            onClick={handleViewAll}
            sx={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: accentMain,
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": {
                textDecoration: "underline",
                color: accentStrong,
              },
            }}
          >
            View All
          </Link>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            flex: 1,
            borderRadius: 2.5,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
            overflow: "hidden",
            background: alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.32 : 0.4),
          }}
        >
          <Table size="medium">
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  "& th": {
                    fontWeight: 700,
                    fontSize: "0.76rem",
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                  },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(!rows || rows.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <DescriptionIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        No recent documents
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {rows && rows.length > 0 && rows.map((row, index) => {
                // Safety checks for row data
                const rowId = row?.id || row?.document_id || `row-${index}`
                const rowName = row?.name || row?.filename || 'Unknown Document'
                const rowUploadDate = row?.uploadDate || row?.created_at || new Date().toISOString()
                const rowStatus = row?.status || 'completed'
                
                return (
                  <TableRow
                    key={rowId}
                    sx={{
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: alpha(accentMain, 0.05),
                      },
                      "&:last-child td": {
                        borderBottom: "none",
                      },
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        maxWidth: { xs: 150, sm: 200 },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rowName}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
                      {formatDate ? formatDate(rowUploadDate) : new Date(rowUploadDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={rowStatus} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View Details" arrow>
                          <IconButton
                            size="small"
                            aria-label="view"
                            onClick={() => handleViewDocument(rowId)}
                            sx={{
                              color: accentMain,
                              "&:hover": {
                                bgcolor: alpha(accentMain, 0.1),
                              },
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download" arrow>
                          <IconButton
                            size="small"
                            aria-label="download"
                            onClick={() => handleDownload(rowId, rowName)}
                            disabled={isDownloading}
                            sx={{
                              color: theme.palette.text.secondary,
                              "&:hover": {
                                bgcolor: alpha(accentMain, 0.1),
                                color: accentMain,
                              },
                              "&:disabled": {
                                opacity: 0.5,
                              },
                            }}
                          >
                            {isDownloading ? (
                              <CircularProgress size={16} />
                            ) : (
                              <UploadFileIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete" arrow>
                          <IconButton
                            size="small"
                            aria-label="delete"
                            onClick={() => handleDeleteClick(rowId, rowName)}
                            disabled={isDeleting}
                            sx={{
                              color: theme.palette.error.main,
                              "&:hover": {
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                              },
                              "&:disabled": {
                                opacity: 0.5,
                              },
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone and will also delete all related data (citations, claims, evidence, etc.).
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : null}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
