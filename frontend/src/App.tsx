import { motion } from "framer-motion";
import { Scan, LogOut } from "lucide-react";
import { ParticleField } from "./components/ParticleField";
import { UploadZone } from "./components/UploadZone";
import { DocumentCard } from "./components/DocumentCard";
import { StatusBar } from "./components/StatusBar";
import { AuthScreen } from "./components/AuthScreen";
import { useDocuments } from "./hooks/useDocuments";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

function App() {
  const { authState, error, signUp, confirmSignUp, signIn, signOut, setError } =
    useAuth();

  // Loading state — checking for existing session
  if (authState.status === "loading") {
    return (
      <>
        <ParticleField />
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.4)",
            fontSize: "14px",
          }}
        >
          Loading...
        </div>
      </>
    );
  }

  // Not signed in — show auth screen
  if (authState.status === "signedOut") {
    return (
      <>
        <ParticleField />
        <AuthScreen
          onSignIn={signIn}
          onSignUp={signUp}
          onVerify={confirmSignUp}
          error={error}
          clearError={() => setError(null)}
        />
      </>
    );
  }

  // Signed in — show the app
  return (
    <>
      <ParticleField />
      <Dashboard
        userId={authState.userId}
        email={authState.email}
        onSignOut={signOut}
      />
    </>
  );
}

function Dashboard({
  userId,
  email,
  onSignOut,
}: {
  userId: string;
  email: string;
  onSignOut: () => void;
}) {
  const { documents, isLoading, uploadDocument, isConnected } =
    useDocuments(userId);

  const processingCount = documents.filter(
    (d) => d.status === "processing" || d.status === "pending"
  ).length;

  return (
    <div className="app-container">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="app-header"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="logo-group">
            <div className="logo-icon">
              <Scan size={22} color="rgba(99, 190, 255, 0.9)" />
            </div>
            <div>
              <h1 className="logo-text">DocuLens</h1>
              <p className="logo-subtitle">AI Document Intelligence</p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              {email}
            </span>
            <motion.button
              onClick={onSignOut}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                color: "rgba(255,255,255,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Sign out"
            >
              <LogOut size={16} />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <UploadZone onUpload={uploadDocument} />
      </motion.div>

      {/* Status Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <StatusBar
          isConnected={isConnected}
          documentCount={documents.length}
          processingCount={processingCount}
        />
      </motion.div>

      {/* Document List */}
      <div className="document-list">
        {isLoading ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="empty-state"
          >
            Loading documents...
          </motion.p>
        ) : documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="empty-state"
          >
            <p className="empty-title">No documents yet</p>
            <p className="empty-subtitle">
              Drop a file above to get started. Claude analyzes it in
              seconds.
            </p>
          </motion.div>
        ) : (
          documents.map((doc, i) => (
            <DocumentCard key={doc.documentId} document={doc} index={i} />
          ))
        )}
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="app-footer"
      >
        <p>
          Powered by Claude AI, AWS Lambda, S3, DynamoDB & EventBridge
        </p>
      </motion.footer>
    </div>
  );
}

export default App;
