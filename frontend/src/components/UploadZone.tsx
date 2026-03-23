import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, Check } from "lucide-react";

interface UploadZoneProps {
  onUpload: (file: File) => Promise<string>;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "success"
  >("idle");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        setUploadState("uploading");
        try {
          await onUpload(file);
          setUploadState("success");
          setTimeout(() => setUploadState("idle"), 2000);
        } catch (err) {
          console.error("Upload failed:", err);
          setUploadState("idle");
        }
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/*": [".txt", ".csv", ".md", ".json", ".xml", ".html"],
      "application/pdf": [".pdf"],
      "application/json": [".json"],
    },
    multiple: true,
  });

  return (
    <motion.div
      {...getRootProps()}
      className="upload-zone"
      animate={{
        borderColor: isDragActive
          ? "rgba(99, 190, 255, 0.8)"
          : "rgba(99, 190, 255, 0.15)",
        background: isDragActive
          ? "rgba(99, 190, 255, 0.08)"
          : "rgba(255, 255, 255, 0.02)",
      }}
      whileHover={{
        borderColor: "rgba(99, 190, 255, 0.4)",
        background: "rgba(99, 190, 255, 0.04)",
      }}
      transition={{ duration: 0.3 }}
      style={{
        border: "1.5px dashed",
        borderRadius: "16px",
        padding: "48px 32px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <input {...getInputProps()} />

      <AnimatePresence mode="wait">
        {uploadState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <motion.div
              animate={{
                y: isDragActive ? -8 : 0,
                scale: isDragActive ? 1.1 : 1,
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {isDragActive ? (
                <FileText size={40} color="rgba(99, 190, 255, 0.9)" />
              ) : (
                <Upload size={40} color="rgba(99, 190, 255, 0.5)" />
              )}
            </motion.div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.8)",
                  fontSize: "15px",
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                {isDragActive
                  ? "Release to analyze"
                  : "Drop documents here or click to browse"}
              </p>
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.35)",
                  fontSize: "13px",
                  marginTop: "8px",
                }}
              >
                Supports TXT, CSV, MD, JSON, XML, HTML, PDF
              </p>
            </div>
          </motion.div>
        )}

        {uploadState === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 size={40} color="rgba(99, 190, 255, 0.8)" />
            </motion.div>
            <p
              style={{
                color: "rgba(99, 190, 255, 0.9)",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              Uploading to S3...
            </p>
          </motion.div>
        )}

        {uploadState === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              <Check size={40} color="rgba(80, 220, 160, 0.9)" />
            </motion.div>
            <p
              style={{
                color: "rgba(80, 220, 160, 0.9)",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              Uploaded — analysis starting
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle shimmer effect on drag */}
      {isDragActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 50%, rgba(99, 190, 255, 0.05) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}
    </motion.div>
  );
}
