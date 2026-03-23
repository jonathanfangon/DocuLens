import { useEffect, useRef, useState } from "react";
import { config } from "../config";
import type { DocumentAnalysis } from "./useDocuments";

interface WSMessage {
  type: string;
  documentId: string;
  status: string;
  fileName?: string;
  analysis?: DocumentAnalysis;
  error?: string;
  completedAt?: string;
}

export function useWebSocket(userId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<number>(undefined);

  useEffect(() => {
    if (!userId || !config.wsUrl) return;

    function connect() {
      const ws = new WebSocket(`${config.wsUrl}?userId=${userId}`);

      ws.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [userId]);

  return { lastMessage, isConnected };
}
