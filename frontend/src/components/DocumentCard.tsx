import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Brain,
  Shield,
  Tag,
  Zap,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import type { Document } from "../hooks/useDocuments";

interface DocumentCardProps {
  document: Document;
  index: number;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "rgba(255, 200, 60, 0.8)",
    bg: "rgba(255, 200, 60, 0.08)",
    label: "Queued",
  },
  processing: {
    icon: Loader2,
    color: "rgba(99, 190, 255, 0.9)",
    bg: "rgba(99, 190, 255, 0.08)",
    label: "Analyzing",
  },
  complete: {
    icon: CheckCircle2,
    color: "rgba(80, 220, 160, 0.9)",
    bg: "rgba(80, 220, 160, 0.08)",
    label: "Complete",
  },
  failed: {
    icon: AlertCircle,
    color: "rgba(255, 100, 100, 0.9)",
    bg: "rgba(255, 100, 100, 0.08)",
    label: "Failed",
  },
};

const sentimentColors: Record<string, string> = {
  positive: "rgba(80, 220, 160, 0.8)",
  negative: "rgba(255, 100, 100, 0.8)",
  neutral: "rgba(180, 180, 200, 0.8)",
  mixed: "rgba(200, 160, 255, 0.8)",
};

export function DocumentCard({ document: doc, index }: DocumentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = statusConfig[doc.status];
  const StatusIcon = status.icon;

  const [now] = useState(() => Date.now());

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor(
      (now - new Date(dateStr).getTime()) / 1000
    );
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
      layout
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "14px",
        overflow: "hidden",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div
        onClick={() => doc.status === "complete" && setIsExpanded(!isExpanded)}
        style={{
          padding: "20px 24px",
          cursor: doc.status === "complete" ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            background: status.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <motion.div
            animate={
              doc.status === "processing" ? { rotate: 360 } : undefined
            }
            transition={
              doc.status === "processing"
                ? { repeat: Infinity, duration: 1.5, ease: "linear" }
                : undefined
            }
          >
            <StatusIcon size={20} color={status.color} />
          </motion.div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "14px",
              fontWeight: 500,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.fileName}
          </p>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.35)",
              fontSize: "12px",
              margin: "4px 0 0",
            }}
          >
            {timeAgo(doc.createdAt)}
          </p>
        </div>

        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: status.color,
            background: status.bg,
            padding: "4px 10px",
            borderRadius: "20px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {status.label}
        </span>

        {doc.status === "complete" && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} color="rgba(255,255,255,0.3)" />
          </motion.div>
        )}
      </div>

      {/* Processing animation bar */}
      {doc.status === "processing" && (
        <div style={{ padding: "0 24px 16px" }}>
          <div
            style={{
              height: "2px",
              borderRadius: "1px",
              background: "rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "easeInOut",
              }}
              style={{
                width: "40%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent, rgba(99, 190, 255, 0.6), transparent)",
              }}
            />
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "rgba(99, 190, 255, 0.6)",
              marginTop: "10px",
              fontStyle: "italic",
            }}
          >
            Claude is analyzing your document...
          </p>
        </div>
      )}

      {/* Error message */}
      {doc.status === "failed" && doc.errorMessage && (
        <div style={{ padding: "0 24px 16px" }}>
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255, 100, 100, 0.7)",
            }}
          >
            {doc.errorMessage}
          </p>
        </div>
      )}

      {/* Analysis Results — Expanded */}
      {doc.status === "complete" && doc.analysis && isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ padding: "24px" }}>
            {/* Summary */}
            <div style={{ marginBottom: "24px" }}>
              <p
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "14px",
                  lineHeight: "1.7",
                  margin: 0,
                }}
              >
                {doc.analysis.summary}
              </p>
            </div>

            {/* Metadata pills */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "24px",
              }}
            >
              <Pill
                icon={<FileText size={12} />}
                label={doc.analysis.documentType}
                color="rgba(99, 190, 255, 0.7)"
              />
              <Pill
                icon={<Brain size={12} />}
                label={`${Math.round(doc.analysis.confidenceScore * 100)}% confidence`}
                color="rgba(200, 160, 255, 0.7)"
              />
              <Pill
                icon={<Zap size={12} />}
                label={doc.analysis.sentiment}
                color={sentimentColors[doc.analysis.sentiment] || sentimentColors.neutral}
              />
            </div>

            {/* Topics */}
            {doc.analysis.topics?.length > 0 && (
              <Section title="Topics" icon={<Tag size={14} />}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {doc.analysis.topics.map((topic: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.6)",
                        background: "rgba(255,255,255,0.05)",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Key Findings */}
            {doc.analysis.keyFindings?.length > 0 && (
              <Section title="Key Findings" icon={<CheckCircle2 size={14} />}>
                <ul style={{ margin: 0, paddingLeft: "16px" }}>
                  {doc.analysis.keyFindings.map(
                    (finding: string, i: number) => (
                      <li
                        key={i}
                        style={{
                          color: "rgba(255,255,255,0.65)",
                          fontSize: "13px",
                          lineHeight: "1.7",
                          marginBottom: "4px",
                        }}
                      >
                        {finding}
                      </li>
                    )
                  )}
                </ul>
              </Section>
            )}

            {/* Entities */}
            {doc.analysis.entities?.length > 0 && (
              <Section title="Entities" icon={<Zap size={14} />}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {doc.analysis.entities.map((entity: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "12px",
                        color: "rgba(200, 160, 255, 0.8)",
                        background: "rgba(200, 160, 255, 0.08)",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        border: "1px solid rgba(200, 160, 255, 0.15)",
                      }}
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Action Items */}
            {doc.analysis.actionItems?.length > 0 && (
              <Section title="Action Items" icon={<Zap size={14} />}>
                <ul style={{ margin: 0, paddingLeft: "16px" }}>
                  {doc.analysis.actionItems.map(
                    (item: string, i: number) => (
                      <li
                        key={i}
                        style={{
                          color: "rgba(99, 190, 255, 0.7)",
                          fontSize: "13px",
                          lineHeight: "1.7",
                          marginBottom: "4px",
                        }}
                      >
                        {item}
                      </li>
                    )
                  )}
                </ul>
              </Section>
            )}

            {/* Risk Flags */}
            {doc.analysis.riskFlags?.length > 0 && (
              <Section title="Risk Flags" icon={<Shield size={14} />}>
                <ul style={{ margin: 0, paddingLeft: "16px" }}>
                  {doc.analysis.riskFlags.map(
                    (risk: string, i: number) => (
                      <li
                        key={i}
                        style={{
                          color: "rgba(255, 160, 80, 0.8)",
                          fontSize: "13px",
                          lineHeight: "1.7",
                          marginBottom: "4px",
                        }}
                      >
                        {risk}
                      </li>
                    )
                  )}
                </ul>
              </Section>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Pill({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        color,
        background: color.replace(/[\d.]+\)$/, "0.08)"),
        padding: "4px 12px",
        borderRadius: "20px",
        border: `1px solid ${color.replace(/[\d.]+\)$/, "0.15)")}`,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{icon}</span>
        <h4
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            margin: 0,
          }}
        >
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
