// Global, reusable constants for the frontend. Keep this file framework-agnostic.
import { API_URL as RUNTIME_API_URL } from "../config/runtimeConfig";

export const APP = Object.freeze({
	NAME: "Atlas",
});

export const STORAGE_KEYS = Object.freeze({
	TOKEN: "token",
	THEME: "theme",
	SIDEBAR_MINI: "sidebar-mini",
});

export const ROUTES = Object.freeze({
	ROOT: "/",
	LOGIN: "/login",
	REGISTER: "/register",
	RESET_PASSWORD: "/reset-password",
	DASHBOARD: "/dashboard",
	DOCUMENTS: "/documents",
	DOCUMENT_DETAIL: "/documents/:documentId",
	DOCUMENT_CITATIONS: "/documents/:documentId/citations",
	DOCUMENT_CLAIMS: "/documents/:documentId/claims",
	DOCUMENT_UPLOAD: "/documents/upload",
	CITATIONS: "/citations",
	CITATION_DETAIL: "/citations/:citationId",
	CITATIONS_BY_DOCUMENT: "/documents/:documentId/citations",
	CLAIMS: "/claims",
	CLAIM_DETAIL: "/claims/:claimId",
	CLAIMS_BY_DOCUMENT: "/documents/:documentId/claims",
	SETTINGS: "/settings",
	DRAFTING_ASSISTANT: "/drafting-assistant",
	CHAT: "/chat",
	CASES: "/cases",
	CASE_DETAIL: "/cases/:caseId",
});

const runtimeApiUrl = String(RUNTIME_API_URL || "").trim() || "http://localhost:9006/api";
export const API_BASE_URL = runtimeApiUrl.endsWith("/api")
	? runtimeApiUrl.slice(0, -4)
	: runtimeApiUrl;

export const apiUrl = (path) => {
	const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
	const p = path.startsWith("/") ? path : `/${path}`;
	return `${base}${p}`;
};

export const API_ENDPOINTS = Object.freeze({
	auth: Object.freeze({
		login: () => apiUrl("/api/auth/login"),
		register: () => apiUrl("/api/auth/register"),
		me: () => apiUrl("/api/auth/me"),
	}),
	documents: Object.freeze({
		list: () => apiUrl("/api/files/"),
		upload: () => apiUrl("/api/files/upload"),
		byId: (id) => apiUrl(`/api/files/${id}`),
		text: (filename) => apiUrl(`/api/files/${filename}/text`),
		extractText: (id) => apiUrl(`/api/files/${id}/extract-text`),
		delete: (id) => apiUrl(`/api/files/${id}`),
	}),
	cases: Object.freeze({
		list: () => apiUrl("/api/cases"),
		byId: (id) => apiUrl(`/api/cases/${id}`),
	}),
	ai: Object.freeze({
		summarize: (docId) => apiUrl(`/api/ai/summarize/${docId}`),
		precedents: () => apiUrl("/api/ai/precedents"),
	}),
	citations: Object.freeze({
		extract: (docId) => apiUrl(`/api/citations/documents/${docId}/extract`),
		byDocument: (docId) => apiUrl(`/api/citations/documents/${docId}`),
		byId: (id) => apiUrl(`/api/citations/${id}`),
		delete: (docId) => apiUrl(`/api/citations/documents/${docId}`),
	}),
});

export const UPLOAD = Object.freeze({
	MAX_FILES: 10,
	MAX_UPLOAD_MB: 25,
	ALLOWED_MIME_TYPES: Object.freeze([
		"application/pdf",
		"image/jpeg",
		"image/png",
		"image/tiff",
		"text/markdown",
		"text/x-markdown",
		"text/plain",
		"application/x-markdown",
	]),
});

export const DOC_STATUS = Object.freeze({
	COMPLETED: "completed",
	PROCESSING: "processing",
	ERROR: "error",
});

export const PAGINATION = Object.freeze({
	DEFAULT_PAGE_SIZE: 10,
	PAGE_SIZES: Object.freeze([5, 10, 25]),
});

export const QUERY_KEYS = Object.freeze({
	documents: Object.freeze({
		all: ["documents"],
		list: (params = {}) => ["documents", "list", params],
		detail: (id) => ["documents", "detail", id],
	}),
	auth: Object.freeze({
		me: ["auth", "me"],
	}),
});

export const UI = Object.freeze({
	DRAWER_WIDTH: 240,
	DRAWER_MINI_WIDTH: 72,
});

export const ERRORS = Object.freeze({
	NETWORK: "Network error. Please try again.",
	UNAUTHORIZED: "Your session has expired. Please sign in again.",
	UPLOAD_TOO_LARGE: `File exceeds the maximum size of ${UPLOAD.MAX_UPLOAD_MB} MB`,
	UPLOAD_TYPE_NOT_ALLOWED: "File type is not allowed.",
});

export default {
	APP, STORAGE_KEYS, ROUTES, API_BASE_URL, apiUrl, API_ENDPOINTS,
	UPLOAD, DOC_STATUS, PAGINATION, QUERY_KEYS, UI, ERRORS,
};
