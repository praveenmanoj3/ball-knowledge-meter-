"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { getSessionByCode, joinSession } from "@/lib/api";

type Step = "code" | "name";

const AVATARS = ["🐝", "🔥", "🦤", "⚡", "🏆", "🎯", "🚀", "👑"];

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchedSession, setMatchedSession] = useState<any>(null);

  // Pre-fill code from query
  useEffect(() => {
    const c = searchParams.get("code");
    if (c) {
      setCode(c.toUpperCase());
    }
  }, [searchParams]);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 3) {
      setError("Please enter a valid session code.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const session = await getSessionByCode(trimmed);
      if (!session) {
        setError("Session not found. Double-check your code.");
        setLoading(false);
        return;
      }
      setMatchedSession(session);
      setStep("name");
    } catch (err) {
      setError("Error finding session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your nickname.");
      return;
    }
    if (!matchedSession) return;

    setError("");
    setLoading(true);

    try {
      const participant = await joinSession(matchedSession.id, name.trim(), selectedAvatar);
      if (participant) {
        // Store participant info in sessionStorage for the game
        sessionStorage.setItem("bkm_participant_id", participant.id);
        sessionStorage.setItem("bkm_nickname", participant.nickname);
        sessionStorage.setItem("bkm_avatar", participant.avatar);
        sessionStorage.setItem("bkm_session_id", matchedSession.id);

        router.push(`/play/${matchedSession.id}`);
      } else {
        setError("Could not join session. Please try another nickname.");
        setLoading(false);
      }
    } catch (err) {
      setError("Failed to join. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      {/* Brand */}
      <div className="brand" style={{ marginBottom: "2rem" }}>
        <div className="brand__mark" />
        <span className="brand__text">BKM</span>
      </div>

      {/* Card */}
      <div
        className="pin-card animate-scale-in"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "2rem",
        }}
      >
        {step === "code" ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.8rem" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "3.5rem",
                  height: "3.5rem",
                  border: "var(--border-default)",
                  background: "var(--color-brand-yellow)",
                  boxShadow: "var(--shadow-sm)",
                  marginBottom: "1rem",
                }}
              >
                <Zap size={24} />
              </div>
              <h1
                style={{
                  margin: "0 0 0.4rem",
                  fontFamily: "var(--font-display)",
                  fontSize: "2.3rem",
                  color: "var(--color-text-strong)",
                  lineHeight: 1,
                }}
              >
                JOIN QUIZ
              </h1>
              <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>
                Enter the session PIN from the host
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label
                  htmlFor="session-code"
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--color-text-muted)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Session Code
                </label>
                <input
                  id="session-code"
                  className="input"
                  type="text"
                  placeholder="e.g. B4K29"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoComplete="off"
                  autoFocus
                  style={{
                    textAlign: "center",
                    fontSize: "2rem",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.2em",
                    padding: "1rem",
                  }}
                />
              </div>

              {error && (
                <p style={{ margin: 0, color: "#ef4444", fontWeight: 700, fontSize: "0.85rem" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: "100%", fontSize: "1rem", padding: "1rem" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <>Next <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "1.8rem" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "3.5rem",
                  height: "3.5rem",
                  border: "var(--border-default)",
                  background: "var(--color-brand-green)",
                  boxShadow: "var(--shadow-sm)",
                  marginBottom: "1rem",
                }}
              >
                <Sparkles size={24} color="#fff" />
              </div>
              <h1
                style={{
                  margin: "0 0 0.4rem",
                  fontFamily: "var(--font-display)",
                  fontSize: "2.3rem",
                  color: "var(--color-text-strong)",
                  lineHeight: 1,
                }}
              >
                YOUR NICKNAME
              </h1>
              <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>
                Choose your avatar & player tag
              </p>
            </div>

            {/* Avatar Selector */}
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1.2rem" }}>
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setSelectedAvatar(av)}
                  style={{
                    fontSize: "1.5rem",
                    padding: "0.4rem",
                    background: selectedAvatar === av ? "var(--color-brand-yellow)" : "var(--color-surface-muted)",
                    border: "2px solid #000",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  {av}
                </button>
              ))}
            </div>

            <form onSubmit={handleNameSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label
                  htmlFor="participant-name"
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--color-text-muted)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Player Name
                </label>
                <input
                  id="participant-name"
                  className="input"
                  type="text"
                  placeholder="e.g. Leo10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  autoFocus
                  style={{
                    textAlign: "center",
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    padding: "0.8rem",
                  }}
                />
              </div>

              {error && (
                <p style={{ margin: 0, color: "#ef4444", fontWeight: 700, fontSize: "0.85rem" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-green"
                style={{ width: "100%", fontSize: "1.1rem", padding: "1rem" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Enter Game Arena ⚽"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: "3rem", textAlign: "center" }}>Loading...</div>}>
      <JoinPageInner />
    </Suspense>
  );
}
