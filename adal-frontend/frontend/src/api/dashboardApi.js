import axiosClient from "./axiosClient";
import logger from "../utils/logger";

const logAndRethrow = (label, error) => {
  const status = error?.response?.status || null;
  const data = error?.response?.data || null;
  const url = error?.config?.url || null;
  logger.error(`[dashboardApi] ${label} error:`, { message: error?.message, status, url, data });
  throw error;
};

const dashboardApi = {
  getOverview: () =>
    axiosClient
      .get("/dashboard/overview")
      .then((response) => response?.data)
      .catch((error) => logAndRethrow("getOverview", error)),
};

export default dashboardApi;
