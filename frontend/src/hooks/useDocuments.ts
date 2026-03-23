import { useState, useEffect, useCallback } from "react";
import { config } from "../config";
import { useWebSocket } from "./useWebSocket";

export interface DocumentAnalysis {
  summary: string;
  documentType: string;
  keyFindings: string[];
  entities: string[];
  sentiment: string;
  topics: string[];
  actionItems: string[];
  riskFlags: string[];
  confidenceScore: number;
}

export interface Document {
  documentId: string;
  fileName: string;
  fileType: string;
  status: "pending" | "processing" | "complete" | "failed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  analysis?: DocumentAnalysis;
  errorMessage?: string;
}

export function useDocuments(userId: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { lastMessage, isConnected } = useWebSocket(userId);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(
        `${config.apiUrl}/documents?userId=${userId}`
      );
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle real-time updates from WebSocket
  useEffect(() => {
    if (!lastMessage) return;

    setDocuments((prev) => {
      const idx = prev.findIndex(
        (d) => d.documentId === lastMessage.documentId
      );
      if (idx === -1) return prev;

      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        status: lastMessage.status as Document["status"],
        ...(lastMessage.analysis && { analysis: lastMessage.analysis }),
        ...(lastMessage.completedAt && {
          completedAt: lastMessage.completedAt,
        }),
        ...(lastMessage.error && { errorMessage: lastMessage.error }),
      };
      return updated;
    });
  }, [lastMessage]);

  const uploadDocument = async (file: File) => {
    // Get presigned URL from our API
    const response = await fetch(`${config.apiUrl}/documents/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        userId,
      }),
    });

    const { uploadUrl, documentId } = await response.json();

    // Upload directly to S3 using the presigned URL
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });

    // Add the new document to local state immediately
    const newDoc: Document = {
      documentId,
      fileName: file.name,
      fileType: file.type,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocuments((prev) => [newDoc, ...prev]);
    return documentId;
  };

  return { documents, isLoading, uploadDocument, isConnected, fetchDocuments };
}
