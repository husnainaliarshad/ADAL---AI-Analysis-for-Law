import axiosClient from "./axiosClient";
import logger from "../utils/logger";

const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null;
  const data = error?.response?.data || null;
  const url = error?.config?.url || null;
  logger.error(`[caseFactsApi] ${label} error:`, { message: error?.message, status, url, data });
  throw error;
};

const generateCaseFacts = (documentId) =>
  axiosClient
    .post(`/case-facts/${documentId}`, {}, { timeout: 120000 })
    .catch((err) => logAndRethrow("generateCaseFacts", err));

const caseFactsApi = {
  generateCaseFacts,
};

export default caseFactsApi;
