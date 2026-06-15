import axiosClient from "./axiosClient";
import logger from "../utils/logger";

let _activeCaseId = null;
export function setActiveCaseIdForFiles(caseId) { _activeCaseId = caseId; }

export const fetchFiles = async (options = {}) => {
  const { skip = 0, limit = 100, retries = 2, delay = 1000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const params = { skip, limit };
      if (_activeCaseId) params.case_id = _activeCaseId;

      const res = await axiosClient.get("/files/", { params, timeout: 30000 });

      return {
        files: res.data.files || res.data || [],
        total_files: res.data.total_files || 0,
        count: res.data.count || 0,
        skip: res.data.skip || skip,
        limit: res.data.limit || limit,
      };
    } catch (error) {
      lastError = error;
      if (error.response?.status >= 400 && error.response?.status < 500) {
        const retryableStatuses = [408, 429];
        if (!retryableStatuses.includes(error.response.status)) throw error;
      }
      if (attempt < retries) {
        const backoffDelay = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        logger.debug(`[fetchFiles] Retry attempt ${attempt + 1}/${retries} after ${backoffDelay}ms`);
      }
    }
  }
  throw lastError;
};

export const deleteFile = async (documentId) => {
  try {
    const res = await axiosClient.delete(`/files/${documentId}`);
    return res.data;
  } catch (error) {
    logger.error(`Failed to delete file ${documentId}:`, error);
    throw error;
  }
};
