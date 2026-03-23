import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, ArrowRight, Mail, Lock, Hash, ArrowLeft } from "lucide-react";

type AuthView = "signIn" | "signUp" | "verify";

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSignUp: (email: string, password: string) => Promise<boolean>;
  onVerify: (email: string, code: string) => Promise<boolean>;
  error: string | null;
  clearError: () => void;
}

export function AuthScreen({
  onSignIn,
  onSignUp,
  onVerify,
  error,
  clearError,
}: AuthScreenProps) {
  const [view, setView] = useState<AuthView>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchView = (newView: AuthView) => {
    clearError();
    setView(newView);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSignIn(email, password);
    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onSignUp(email, password);
    setIsSubmitting(false);
    if (success) {
      switchView("verify");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onVerify(email, code);
    setIsSubmitting(false);
    if (success) {
      switchView("signIn");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: "100%",
          maxWidth: "380px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(99, 190, 255, 0.08)",
              border: "1px solid rgba(99, 190, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Scan size={20} color="rgba(99, 190, 255, 0.9)" />
          </div>
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.9)",
                margin: 0,
                letterSpacing: "-0.5px",
              }}
            >
              DocuLens
            </h1>
            <p
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.4)",
                margin: "2px 0 0",
              }}
            >
              AI Document Intelligence
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Sign In */}
          {view === "signIn" && (
            <motion.form
              key="signIn"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSignIn}
            >
              <h2 style={styles.heading}>Welcome back</h2>
              <p style={styles.subheading}>
                Sign in to your account
              </p>

              <InputField
                icon={<Mail size={16} />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={setEmail}
              />
              <InputField
                icon={<Lock size={16} />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={setPassword}
              />

              {error && <ErrorMessage message={error} />}

              <SubmitButton
                label="Sign in"
                isSubmitting={isSubmitting}
              />

              <p style={styles.switchText}>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("signUp")}
                  style={styles.switchLink}
                >
                  Sign up
                </button>
              </p>
            </motion.form>
          )}

          {/* Sign Up */}
          {view === "signUp" && (
            <motion.form
              key="signUp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSignUp}
            >
              <h2 style={styles.heading}>Create account</h2>
              <p style={styles.subheading}>
                Password: 8+ chars, uppercase, lowercase, number
              </p>

              <InputField
                icon={<Mail size={16} />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={setEmail}
              />
              <InputField
                icon={<Lock size={16} />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={setPassword}
              />

              {error && <ErrorMessage message={error} />}

              <SubmitButton
                label="Create account"
                isSubmitting={isSubmitting}
              />

              <p style={styles.switchText}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("signIn")}
                  style={styles.switchLink}
                >
                  Sign in
                </button>
              </p>
            </motion.form>
          )}

          {/* Verify */}
          {view === "verify" && (
            <motion.form
              key="verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleVerify}
            >
              <button
                type="button"
                onClick={() => switchView("signUp")}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  padding: 0,
                  marginBottom: "20px",
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>

              <h2 style={styles.heading}>Check your email</h2>
              <p style={styles.subheading}>
                We sent a 6-digit code to{" "}
                <span style={{ color: "rgba(99, 190, 255, 0.9)" }}>
                  {email}
                </span>
              </p>

              <InputField
                icon={<Hash size={16} />}
                type="text"
                placeholder="Verification code"
                value={code}
                onChange={setCode}
                maxLength={6}
              />

              {error && <ErrorMessage message={error} />}

              <SubmitButton
                label="Verify email"
                isSubmitting={isSubmitting}
              />
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function InputField({
  icon,
  type,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        padding: "0 16px",
        marginBottom: "12px",
        transition: "border-color 0.2s",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        required
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          color: "rgba(255,255,255,0.9)",
          fontSize: "14px",
          padding: "14px 0",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function SubmitButton({
  label,
  isSubmitting,
}: {
  label: string;
  isSubmitting: boolean;
}) {
  return (
    <motion.button
      type="submit"
      disabled={isSubmitting}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      style={{
        width: "100%",
        padding: "14px",
        marginTop: "8px",
        background: isSubmitting
          ? "rgba(99, 190, 255, 0.15)"
          : "rgba(99, 190, 255, 0.12)",
        border: "1px solid rgba(99, 190, 255, 0.25)",
        borderRadius: "10px",
        color: "rgba(99, 190, 255, 0.9)",
        fontSize: "14px",
        fontWeight: 600,
        cursor: isSubmitting ? "default" : "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        transition: "all 0.2s",
      }}
    >
      {isSubmitting ? "..." : label}
      {!isSubmitting && <ArrowRight size={16} />}
    </motion.button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        color: "rgba(255, 100, 100, 0.85)",
        fontSize: "13px",
        margin: "0 0 12px",
        padding: "10px 14px",
        background: "rgba(255, 100, 100, 0.06)",
        borderRadius: "8px",
        border: "1px solid rgba(255, 100, 100, 0.12)",
      }}
    >
      {message}
    </motion.p>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: {
    fontSize: "20px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.9)",
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  subheading: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.4)",
    margin: "0 0 24px",
    lineHeight: "1.5",
  },
  switchText: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center" as const,
    marginTop: "20px",
  },
  switchLink: {
    background: "none",
    border: "none",
    color: "rgba(99, 190, 255, 0.8)",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "inherit",
    padding: 0,
    textDecoration: "none",
  },
};
