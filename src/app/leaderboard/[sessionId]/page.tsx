"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Trophy, ChevronLeft, Zap, Loader2 } from "lucide-react";
import { getSession, getSessionParticipants } from "@/lib/api";
import { Participant } from "@/lib/types";

const PODIUM_HEIGHTS = ["110px", "145px", "90px"];
const PODIUM_COLORS = [
  "var(--color-brand-blue)",
  "var(--color-brand-yellow)",
  "var(--color-brand-green)",
];
const PODIUM_BADGES = ["🥈", "🥇", "🥉"];

export default function LeaderboardPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCode, setSessionCode] = useState("");

  useEffect(() => {
    async function init() {
      const data = await getSession(sessionId);
      if (data) {
        setSessionCode(data.session.session_code);
        const sorted = [...data.participants].sort((a, b) => b.score - a.score);
        setParticipants(sorted);
      }
      setLoading(false);
    }
    init();
  }, [sessionId]);

  const top3 = participants.slice(0, 3);
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]  // 2nd, 1st, 3rd
    : top3;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0.75rem 1.5rem",
          borderBottom: "var(--border-default)",
          background: "var(--color-surface)",
          boxShadow: "0 3px 0 0 rgba(0,0,0,0.12)",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/host/${sessionId}`}
          className="btn btn-secondary"
          style={{ padding: "0.55rem 0.9rem", minHeight: "unset" }}
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="brand">
          <div className="brand__mark" />
          <span className="brand__text">BKM</span>
        </div>
        {sessionCode && (
          <div className="session-code" style={{ fontSize: "1.3rem", padding: "0.25rem 0.75rem" }}>
            {sessionCode}
          </div>
        )}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.4rem 0.9rem",
            border: "var(--border-default)",
            background: "var(--color-brand-yellow)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Zap size={14} />
          <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>Live Results</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <Trophy
            size={44}
            color="var(--color-brand-yellow)"
            style={{ marginBottom: "0.75rem" }}
          />
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              color: "var(--color-text-strong)",
              lineHeight: 1,
              letterSpacing: "0.03em",
            }}
          >
            LEADERBOARD
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--color-text-muted)", fontWeight: 600 }}>
            Final Rankings — {participants.length} Players
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <Loader2 size={32} className="animate-spin" color="var(--color-accent-amber)" />
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length >= 3 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  gap: "0.75rem",
                  marginBottom: "2.5rem",
                }}
              >
                {podiumOrder.map((p, i) => (
                  <div
                    key={p.id}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{p.avatar}</span>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem", textAlign: "center" }}>
                      {p.nickname}
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "var(--color-text-muted)" }}>
                      {p.score.toLocaleString()} pts
                    </div>
                    <div
                      style={{
                        width: "90px",
                        height: PODIUM_HEIGHTS[i],
                        background: PODIUM_COLORS[i],
                        border: "var(--border-default)",
                        boxShadow: "var(--shadow-sm)",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        paddingTop: "0.5rem",
                        fontFamily: "var(--font-display)",
                        fontSize: "2rem",
                        borderRadius: "8px 8px 0 0",
                      }}
                    >
                      {PODIUM_BADGES[i]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Full Rankings Table */}
            <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {participants.map((p, idx) => (
                <div
                  key={p.id}
                  className="lb-row"
                  style={idx === 0 ? { background: "var(--color-brand-yellow)", boxShadow: "var(--shadow-md)" } : {}}
                >
                  <div className="lb-rank">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                  </div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>{p.avatar}</span>
                    {p.nickname}
                  </div>
                  <div className="lb-points">
                    {p.score.toLocaleString()}
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontFamily: "var(--font-body)", marginLeft: "0.3rem" }}>pts</span>
                  </div>
                </div>
              ))}
            </div>

            {participants.length === 0 && (
              <div className="pin-card" style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "var(--color-text-muted)", fontWeight: 700 }}>No participants yet</p>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "2.5rem" }}>
              <Link href="/" className="btn btn-primary" style={{ padding: "0.9rem 2rem" }}>
                Back to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
