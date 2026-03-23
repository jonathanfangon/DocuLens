import { motion } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";

interface StatusBarProps {
  isConnected: boolean;
  documentCount: number;
  processingCount: number;
}

export function StatusBar({
  isConnected,
  documentCount,
  processingCount,
}: StatusBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <Stat label="Documents" value={documentCount} />
        {processingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Stat
              label="Processing"
              value={processingCount}
              color="rgba(99, 190, 255, 0.9)"
            />
          </motion.div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <motion.div
          animate={{
            scale: isConnected ? [1, 1.2, 1] : 1,
          }}
          transition={{
            repeat: isConnected ? Infinity : 0,
            duration: 2,
            ease: "easeInOut",
          }}
        >
          {isConnected ? (
            <Wifi size={14} color="rgba(80, 220, 160, 0.7)" />
          ) : (
            <WifiOff size={14} color="rgba(255, 100, 100, 0.6)" />
          )}
        </motion.div>
        <span
          style={{
            fontSize: "11px",
            color: isConnected
              ? "rgba(80, 220, 160, 0.7)"
              : "rgba(255, 100, 100, 0.6)",
            fontWeight: 500,
          }}
        >
          {isConnected ? "Live" : "Reconnecting"}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "rgba(255,255,255,0.8)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <span style={{ fontSize: "20px", fontWeight: 600, color }}>
        {value}
      </span>
      <span
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
    </div>
  );
}
