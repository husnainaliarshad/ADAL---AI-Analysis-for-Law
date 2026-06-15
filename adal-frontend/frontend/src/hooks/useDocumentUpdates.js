import { useEffect, useRef, useState } from "react";
import { API_URL } from "../config/runtimeConfig";
import { getAccessToken } from "../utils/tokenStorage";
import logger from "../utils/logger";

const RECONNECT_DELAY_MS = 3000;

function buildDocumentsWebSocketUrl() {
  const apiUrl = new URL(API_URL);
  const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.protocol = wsProtocol;
  apiUrl.pathname = `${apiUrl.pathname.replace(/\/+$/, "")}/files/ws/updates`;

  const token = getAccessToken();
  if (token) {
    apiUrl.searchParams.set("token", token);
  }

  return apiUrl.toString();
}

export default function useDocumentUpdates(onEvent, enabled = true) {
  const callbackRef = useRef(onEvent);
  const reconnectTimerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return undefined;

    let isDisposed = false;
    let socket = null;

    const cleanupReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      cleanupReconnectTimer();

      try {
        socket = new WebSocket(buildDocumentsWebSocketUrl());
      } catch (error) {
        logger.error("[documents-ws] Failed to create websocket", error);
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }

      socket.onopen = () => {
        if (isDisposed) return;
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        if (isDisposed) return;

        try {
          const payload = JSON.parse(event.data);
          callbackRef.current?.(payload);
        } catch (error) {
          logger.warn("[documents-ws] Failed to parse websocket payload", error);
        }
      };

      socket.onerror = (error) => {
        logger.warn("[documents-ws] Websocket error", error);
      };

      socket.onclose = (event) => {
        if (isDisposed) return;

        setIsConnected(false);

        // Do not reconnect if auth/policy is rejected.
        if (event.code === 1008) {
          logger.warn("[documents-ws] Websocket closed due to auth/policy rejection");
          return;
        }

        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      cleanupReconnectTimer();
      setIsConnected(false);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket) {
        socket.close();
      }
    };
  }, [enabled]);

  return { isConnected };
}
