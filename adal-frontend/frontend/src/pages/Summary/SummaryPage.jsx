import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  TextField,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Chip,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import DescriptionIcon from "@mui/icons-material/Description";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AtlasButton from "../../components/common/AtlasButton";
import summaryApi from "../../api/summaryApi";
import Sidebar from "../../components/layout/Sidebar";

export default function SummaryPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [documentId, setDocumentId] = useState("");
  const [shortMode, setShortMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  const markdownComponents = {
    p: ({ node, ...props }) => (
      <Typography
        sx={{
          color: "text.primary",
          fontSize: "1rem",
          lineHeight: 1.9,
          mb: 1.2,
          "&:last-child": { mb: 0 },
        }}
        {...props}
      />
    ),
    h1: ({ node, ...props }) => (
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, mt: 0.4, color: "text.primary" }} {...props} />
    ),
    h2: ({ node, ...props }) => (
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.8, mt: 0.6, color: "text.primary" }} {...props} />
    ),
    h3: ({ node, ...props }) => (
      <Typography
        sx={{
          color: "success.main",
          fontSize: "0.84rem",
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
      <Typography component="li" sx={{ color: "text.primary", fontSize: "0.98rem", lineHeight: 1.75, mb: 0.45 }} {...props} />
    ),
    strong: ({ node, ...props }) => <Box component="strong" sx={{ fontWeight: 700, color: "text.primary" }} {...props} />,
    blockquote: ({ node, ...props }) => (
      <Box
        component="blockquote"
        sx={{
          m: 0,
          my: 1,
          pl: 1.5,
          borderLeft: `3px solid ${alpha(theme.palette.success.main, 0.35)}`,
          color: "text.secondary",
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
            backgroundColor: alpha(theme.palette.common.black, 0.06),
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
            backgroundColor: alpha(theme.palette.common.black, 0.04),
            overflowX: "auto",
          }}
        >
          <code {...props} />
        </Box>
      ),
  };

  const handleSubmit = async () => {
    if (!documentId) {
      setError("Please enter a document ID");
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await summaryApi.generateSummary({
        documentId: Number(documentId),
        short: shortMode,
      });
      const data = res?.data || res;
      setSummary(data.summary || "No summary returned");
    } catch (err) {
      let msg = "Failed to generate summary";
      if (err.response?.status === 404) msg = "Document not found";
      else if (err.response?.status === 400) msg = err.response?.data?.detail || "Document has no OCR text";
      else if (err.response?.data?.detail) msg = err.response.data.detail;
      else if (err.message) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
        {/* Back Button */}
        <Motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Tooltip title="Go back">
            <IconButton
              onClick={() => navigate(-1)}
              sx={{
                mb: 2,
                color: "text.secondary",
                border: `1px solid ${alpha(theme.palette.divider, 0.25)}`,
                transition: "all 0.2s ease",
                "&:hover": {
                  color: theme.palette.success.main,
                  borderColor: theme.palette.success.main,
                  bgcolor: alpha(theme.palette.success.main, 0.08),
                  transform: "translateX(-4px)",
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        </Motion.div>

        {/* Header Section */}
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card
            elevation={0}
            sx={{
              mb: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              borderRadius: 2,
              boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 32, color: "primary.main" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 700,
                      mb: 0.5,
                      background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.text.primary} 100%)`,
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Document Summary
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Generate intelligent summaries from document OCR text using AI-powered analysis
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Motion.div>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            onClose={() => setError(null)}
            sx={{
              mb: 3,
              borderRadius: 2,
              "& .MuiAlert-message": {
                width: "100%",
              },
            }}
          >
            {error}
          </Alert>
        )}

        {/* Main Form Card */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card
            elevation={0}
            sx={{
              border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              mb: 3,
              borderRadius: 2,
              boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: "all 0.3s ease",
              "&:hover": {
                boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}`,
              },
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
              },
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={3}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <DescriptionIcon sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", fontSize: "1.25rem" }}>
                    Generate Summary
                  </Typography>
                </Box>

                <Divider />

                <Stack spacing={3}>
                  <TextField
                    label="Document ID"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    type="number"
                    size="medium"
                    placeholder="Enter document ID"
                    helperText="Enter the ID of the document you want to summarize"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                      },
                    }}
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                          <DescriptionIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                        </Box>
                      ),
                    }}
                  />

                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={shortMode}
                          onChange={(e) => setShortMode(e.target.checked)}
                          sx={{
                            "& .MuiSwitch-switchBase.Mui-checked": {
                              color: theme.palette.success.main,
                            },
                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                              bgcolor: theme.palette.success.main,
                            },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: "text.primary" }}>
                            Short Summary Mode
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Generate a concise summary instead of a detailed one
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>

                  <AtlasButton
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
                    onClick={handleSubmit}
                    disabled={loading || !documentId}
                    loading={loading}
                    loadingPosition="start"
                    size="large"
                    sx={{
                      py: 1.5,
                      fontSize: "1rem",
                      fontWeight: 600,
                      bgcolor: theme.palette.success.main,
                      "&:hover": { bgcolor: theme.palette.success.dark },
                    }}
                  >
                    {loading ? "Generating Summary..." : "Generate Summary"}
                  </AtlasButton>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Motion.div>

        {/* Summary Result Card */}
        {summary && (
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card
              elevation={0}
              sx={{
                border: `2px solid ${alpha(theme.palette.success.main, 0.2)}`,
                bgcolor: alpha(theme.palette.success.main, 0.05),
                borderRadius: 2,
                transition: "all 0.3s ease",
                boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
                "&:hover": {
                  boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.2)}`,
                  borderColor: alpha(theme.palette.success.main, 0.4),
                },
                position: "relative",
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${alpha(theme.palette.success.main, 0.5)} 100%)`,
                },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.success.main, 0.15),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AutoAwesomeIcon sx={{ fontSize: 24, color: theme.palette.success.main }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>
                        Generated Summary
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={shortMode ? "Short Summary" : "Full Summary"}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.success.main, 0.15),
                            color: theme.palette.success.main,
                            fontWeight: 600,
                          }}
                        />
                        {documentId && (
                          <Typography variant="caption" color="text.secondary">
                            Document ID: {documentId}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                  <Tooltip title="Clear summary">
                    <IconButton
                      size="small"
                      onClick={() => setSummary(null)}
                      sx={{
                        color: "text.secondary",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.error.main, 0.1),
                          color: "error.main",
                        },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                    borderRadius: 2,
                    maxHeight: 600,
                    overflow: "auto",
                    "&::-webkit-scrollbar": {
                      width: "8px",
                    },
                    "&::-webkit-scrollbar-track": {
                      bgcolor: alpha(theme.palette.divider, 0.1),
                      borderRadius: 1,
                    },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: alpha(theme.palette.divider, 0.5),
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: alpha(theme.palette.divider, 0.7),
                      },
                    },
                  }}
                >
                  <Box sx={{ "& > *:last-child": { mb: 0 } }}>
                    <ReactMarkdown components={markdownComponents}>{summary}</ReactMarkdown>
                  </Box>
                </Paper>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 3 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
                  <Typography variant="caption" color="text.secondary">
                    Summary generated successfully
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Motion.div>
        )}
      </Box>
    </Box>
  );
}
