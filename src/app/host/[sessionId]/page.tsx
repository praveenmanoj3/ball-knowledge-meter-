"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  CheckSquare,
  ChevronRight,
  Trophy,
  Zap,
  BarChart2,
  Clock,
  Wifi,
  Copy,
  Check,
  Loader2,
  Eye,
  Lock,
} from "lucide-react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import {
  getSession,
  updateSessionState,
  getSlideResponses,
  getSessionParticipants,
} from "@/lib/api";
import { Session, Slide, Participant, ResponseRecord } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
  "var(--color-brand-blue)",
  "var(--color-brand-green)",
  "var(--color-brand-yellow)",
  "var(--color-brand-pink)",
];

// ── Stat Chip ──────────────────────────────────────────
function StatChip({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="stat-chip" style={{ background: accent || "var(--color-surface)" }}>
      <span className="stat-chip__value" style={{ color: accent ? "#fff" : undefined }}>{value}</span>
      <span className="stat-chip__label" style={{ color: accent ? "rgba(255,255,255,0.8)" : undefined }}>{label}</span>
    </div>
  );
}

// ── Waiting Room ───────────────────────────────────────
// ── Waiting Room ───────────────────────────────────────
function WaitingRoom({
  sessionCode,
  participants,
  onStart,
  onSimulateBots,
  simulating,
}: {
  sessionCode: string;
  participants: Participant[];
  onStart: () => void;
  onSimulateBots: () => void;
  simulating: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${sessionCode}`
    : `/join/${sessionCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: "2rem", padding: "2rem" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)" }}>
          Live 200-Player Session — Supabase Realtime
        </p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "var(--color-text-strong)" }}>
          Join the Arena
        </h1>
      </div>

      <div style={{ display: "flex", gap: "3rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        {/* QR Code */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <div className="qr-container">
            <QRCode value={joinUrl} size={180} bgColor="#ffffff" fgColor="#12100f" level="H" />
          </div>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Scan with phone
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
              Or enter PIN code at
            </p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem", color: "var(--color-text-strong)" }}>
              {typeof window !== "undefined" ? window.location.host : "localhost:3000"}/join
            </p>
          </div>

          <div
            className="session-code"
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem" }}
            onClick={handleCopy}
          >
            {sessionCode}
            <button
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-text-strong)" }}
            >
              {copied ? <Check size={22} /> : <Copy size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Participants Counter & Avatar Stream */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", maxWidth: 650, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.8rem 1.8rem", border: "var(--border-default)", background: "var(--color-surface)", boxShadow: "var(--shadow-sm)", borderRadius: 12 }}>
          <Users size={20} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "2rem", lineHeight: 1, color: "var(--color-text-strong)" }}>
            {participants.length}
          </span>
          <span style={{ fontWeight: 700, color: "var(--color-text-muted)" }}>players joined</span>
        </div>

        {/* Live Roster of participants */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", justifyContent: "center", maxHeight: 130, overflowY: "auto", padding: "0.5rem" }}>
          {participants.map((p) => (
            <span key={p.id} className="pin-card" style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span>{p.avatar}</span> {p.nickname}
            </span>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          className="btn btn-yellow"
          style={{ fontSize: "1.1rem", padding: "1.1rem 2rem" }}
          onClick={onSimulateBots}
          disabled={simulating}
        >
          {simulating ? <Loader2 size={18} className="animate-spin" /> : "🤖"}
          {simulating ? "Joining 200 Bots..." : "Simulate 200 Players"}
        </button>

        <button className="btn btn-green" style={{ fontSize: "1.1rem", padding: "1.1rem 2.5rem" }} onClick={onStart}>
          <Zap size={18} />
          Start Presentation ({participants.length} Ready)
        </button>
      </div>
    </div>
  );
}

// ── Host Live Controller ───────────────────────────────
export default function HostSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [phase, setPhase] = useState<'lobby' | 'preview' | 'live' | 'reveal' | 'leaderboard' | 'ended'>('lobby');
  const [timeLeft, setTimeLeft] = useState(0);
  const [previewTimeLeft, setPreviewTimeLeft] = useState(0);
  const [simulating, setSimulating] = useState(false);

  const insertParticipantBatch = async (batch: Array<{ session_id: string; nickname: string; avatar: string; score: number }>) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.from("participants").insert(batch);
      if (!error) return;
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  };

  // Load initial session
  useEffect(() => {
    async function init() {
      const data = await getSession(sessionId);
      if (data) {
        setSession(data.session);
        setSlides(data.slides);
        setParticipants(data.participants);
        setCurrentSlideIdx(data.session.current_slide_index || 0);
        setPhase(data.session.status);

        if (data.slides[data.session.current_slide_index || 0]) {
          const currentSlide = data.slides[data.session.current_slide_index || 0];
          const resp = await getSlideResponses(sessionId, currentSlide.id);
          setResponses(resp);
          setTimeLeft(currentSlide.time_limit || 20);
        }
      }
      setLoading(false);
    }
    init();
  }, [sessionId]);

  // Realtime subscription for participants and responses
  useEffect(() => {
    if (!sessionId) return;

    const refreshParticipants = async () => {
      const updatedParticipants = await getSessionParticipants(sessionId);
      setParticipants(updatedParticipants);
    };

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setParticipants((prev) => {
            if (prev.some((p) => p.id === payload.new.id)) return prev;
            return [...prev, payload.new as Participant];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
        async () => {
          await refreshParticipants();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'responses', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setResponses((prev) => [...prev, payload.new as ResponseRecord]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Preview countdown timer
  useEffect(() => {
    if (phase !== 'preview' || previewTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setPreviewTimeLeft((prev) => {
        if (prev <= 1) {
          handleUnlockOptions();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, previewTimeLeft]);

  // Answer countdown timer
  useEffect(() => {
    if (phase !== 'live' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto reveal when time expires
          handleRevealAnswer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const handleSimulate200Players = async () => {
    if (simulating) return;
    setSimulating(true);

    const avatars = ["🐝", "🔥", "🦤", "⚡", "🏆", "🎯", "🚀", "👑"];
    const names = [
      "Alex", "Sam", "Leo", "Cristiano", "Kylian", "Erling", "Kevin", "Luka", "Jude", "Mohamed",
      "Neymar", "Pedri", "Bukayo", "Son", "Harry", "Virgil", "Alisson", "Lamine", "Rodri", "Vinicius"
    ];

    const totalToJoin = 200;
    const batchSize = 25;

    try {
      for (let i = 0; i < totalToJoin; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, totalToJoin - i) }, (_, idx) => {
        const pNum = i + idx + 1;
        const randomName = names[pNum % names.length];
        return {
          session_id: sessionId,
          nickname: `${randomName}_${pNum}`,
          avatar: avatars[pNum % avatars.length],
          score: 0,
        };
      });

        await insertParticipantBatch(batch);
      }

      const updatedParticipants = await getSessionParticipants(sessionId);
      setParticipants(updatedParticipants);
      if (updatedParticipants.length < totalToJoin) {
        throw new Error(`Only ${updatedParticipants.length} participants are visible after the simulation.`);
      }
    } catch (error) {
      console.error("Participant simulation failed:", error);
      alert(error instanceof Error ? error.message : "Participant simulation failed. Please try again.");
    } finally {
      setSimulating(false);
    }
  };

  const simulateBotAnswersForCurrentSlide = async () => {
    const slide = slides[currentSlideIdx] || slides[0];
    if (!slide) return;

    const currentSlideResponses = await getSlideResponses(sessionId, slide.id);
    const answeredIds = new Set(currentSlideResponses.map((r) => r.participant_id));
    const unanswered = participants.filter((p) => !answeredIds.has(p.id));

    if (!unanswered.length) return;

    const opts = slide.options || [];
    if (!opts.length) return;

    // ── Real timing window: spread across the actual question time limit ──
    const timeLimitMs = (slide.time_limit || 20) * 1000;

    // ── Build per-bot delays: 90% unique ms, 10% genuine collisions ──
    const usedDelays: number[] = [];
    const delays: number[] = unanswered.map((_, idx) => {
      // First bot always gets a unique delay so usedDelays is never empty
      const canCollide = idx > 0 && Math.random() < 0.10;
      if (canCollide) {
        // Genuinely share a delay — this bot's DB insert will fire at the
        // exact same real-world millisecond as the bot it collides with.
        return usedDelays[Math.floor(Math.random() * usedDelays.length)];
      }
      // Unique delay: 300ms → timeLimitMs, guaranteed distinct
      let delay: number;
      let attempts = 0;
      do {
        // Weight toward earlier responses (feels more human)
        const t = Math.random();
        delay = Math.floor(300 + (t * t * 0.6 + Math.random() * 0.4) * (timeLimitMs - 300));
        attempts++;
      } while (usedDelays.includes(delay) && attempts < 100);
      usedDelays.push(delay);
      return delay;
    });

    // ── Fire each bot's DB insert at their real scheduled delay ──
    // Bots with the same delay truly race to the DB at the same ms.
    const botPromises = unanswered.map((player, idx) => {
      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          const isCorrect = Math.random() < 0.62; // ~62% get it right
          const correctOpts = opts.filter((o: any) => o.is_correct);
          const wrongOpts = opts.filter((o: any) => !o.is_correct);
          const chosenOpt = isCorrect
            ? (correctOpts[Math.floor(Math.random() * correctOpts.length)] ?? opts[0])
            : (wrongOpts[Math.floor(Math.random() * wrongOpts.length)] ?? opts[0]);

          const responseTimeMs = delays[idx];
          // Faster answer → more points (mirrors the real scoring formula)
          const speedRatio = Math.max(0, 1 - responseTimeMs / timeLimitMs);
          const pointsAwarded = isCorrect ? Math.round(500 + speedRatio * 500) : 0;

          // Actual DB write at this real-world millisecond
          await supabase.from("responses").insert([{
            session_id: sessionId,
            slide_id: slide.id,
            participant_id: player.id,
            selected_option_id: chosenOpt?.id ?? null,
            is_correct: isCorrect,
            response_time_ms: responseTimeMs,   // = real elapsed time
            points_awarded: pointsAwarded,
          }]);

          if (pointsAwarded > 0) {
            await supabase
              .from("participants")
              .update({ score: (player.score || 0) + pointsAwarded })
              .eq("id", player.id);
          }

          resolve();
        }, delays[idx]); // ← actual setTimeout delay — not faked
      });
    });

    // Wait for the slowest bot (≤ time_limit seconds)
    await Promise.all(botPromises);

    const updatedResp = await getSlideResponses(sessionId, slide.id);
    setResponses(updatedResp);
  };

  const handleUnlockOptions = async () => {
    const slide = slides[currentSlideIdx] || slides[0];
    setPhase('live');
    setTimeLeft(slide.time_limit || 20);
    setResponses([]);

    await updateSessionState(sessionId, {
      status: 'live',
      phase_started_at: new Date().toISOString(),
    });

    simulateBotAnswersForCurrentSlide();
  };

  const startSlidePhase = async (slideIdx: number) => {
    const slide = slides[slideIdx];
    if (!slide) return;
    setCurrentSlideIdx(slideIdx);
    setResponses([]);

    const isOpeningQuiz = slideIdx === 0 && phase === 'lobby';
    const pTime = isOpeningQuiz ? 5 : (slide.preview_time !== undefined ? slide.preview_time : 5);

    if (pTime > 0) {
      setPhase('preview');
      setPreviewTimeLeft(pTime);
      await updateSessionState(sessionId, {
        status: 'preview',
        current_slide_id: slide.id,
        current_slide_index: slideIdx,
        phase_started_at: new Date().toISOString(),
      });
    } else {
      setPhase('live');
      setTimeLeft(slide.time_limit || 20);
      await updateSessionState(sessionId, {
        status: 'live',
        current_slide_id: slide.id,
        current_slide_index: slideIdx,
        phase_started_at: new Date().toISOString(),
      });
      simulateBotAnswersForCurrentSlide();
    }
  };

  const handleStartSession = async () => {
    if (!slides.length) return;
    await startSlidePhase(0);
  };

  const handleRevealAnswer = async () => {
    setPhase('reveal');
    await updateSessionState(sessionId, {
      status: 'reveal',
    });

    // Allow the final score updates from the response submissions to land before
    // we render the immediate question leaderboard. This avoids stale scores on
    // the very first leaderboard shown after a correct answer in the final seconds.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const updatedParticipants = await getSessionParticipants(sessionId);
    setParticipants(updatedParticipants);
  };

  const handleShowLeaderboard = async () => {
    setPhase('leaderboard');
    const updatedParticipants = await getSessionParticipants(sessionId);
    setParticipants(updatedParticipants);
    await updateSessionState(sessionId, {
      status: 'leaderboard',
    });
  };

  const handleNextSlide = async () => {
    if (currentSlideIdx + 1 < slides.length) {
      await startSlidePhase(currentSlideIdx + 1);
    } else {
      setPhase('ended');
      await updateSessionState(sessionId, {
        status: 'ended',
        ended_at: new Date().toISOString(),
      });
    }
  };

  const currentSlide = slides[currentSlideIdx] || slides[0];
  const isOpeningCountdown = phase === 'preview' && currentSlideIdx === 0 && previewTimeLeft > 0;

  useEffect(() => {
    const slidesToWarm = [slides[currentSlideIdx], slides[currentSlideIdx + 1]];
    const links = slidesToWarm
      .filter((slide) => slide?.media_url)
      .map((slide) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = slide!.media_url;
        link.as = slide!.media_type === 'video' ? 'video' : 'image';
        link.setAttribute('data-bkm-media-preload', 'true');
        document.head.appendChild(link);
        return link;
      });

    return () => {
      links.forEach((link) => link.remove());
    };
  }, [currentSlideIdx, slides]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div className="pin-card" style={{ padding: "2rem 3rem", textAlign: "center" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 1rem", color: "var(--color-accent-amber)" }} />
          <p style={{ fontWeight: 800, margin: 0 }}>Connecting Live Arena...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h2>Session not found</h2>
        <p style={{ color: "var(--color-text-muted)" }}>This live session link may be expired or invalid.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>Back to Dashboard</Link>
      </div>
    );
  }

  if (!currentSlide) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h2>No slides in this presentation</h2>
        <p style={{ color: "var(--color-text-muted)" }}>Please add at least one question slide in the editor before presenting.</p>
        <Link href={`/editor/${session.presentation_id}`} className="btn btn-primary" style={{ marginTop: "1rem" }}>Open Presentation Editor</Link>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div style={{ minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1.5rem", borderBottom: "var(--border-default)", background: "var(--color-surface)", boxShadow: "0 3px 0 0 var(--color-shadow)" }}>
          <Link href="/" className="btn btn-secondary" style={{ padding: "0.55rem 0.9rem", minHeight: "unset" }}>← Dashboard</Link>
          <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Wifi size={14} color="#16a34a" />
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16a34a" }}>Supabase Live</span>
          </div>
        </header>
        <WaitingRoom
          sessionCode={session.session_code}
          participants={participants}
          onStart={handleStartSession}
          onSimulateBots={handleSimulate200Players}
          simulating={simulating}
        />
      </div>
    );
  }

  if (phase === 'leaderboard' || phase === 'ended') {
    const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);
    return (
      <div style={{ minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1.5rem", borderBottom: "var(--border-default)", background: "var(--color-surface)", boxShadow: "0 3px 0 0 var(--color-shadow)", flexWrap: "wrap" }}>
          <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>
          <div className="session-code" style={{ fontSize: "1.5rem", padding: "0.3rem 0.8rem" }}>{session.session_code}</div>
          <div style={{ marginLeft: "auto" }}>
            {currentSlideIdx + 1 < slides.length ? (
              <button className="btn btn-green" onClick={handleNextSlide}>
                <ChevronRight size={16} />
                Next Question ({currentSlideIdx + 2}/{slides.length})
              </button>
            ) : (
              <Link href="/" className="btn btn-primary">
                Finish Presentation
              </Link>
            )}
          </div>
        </header>

        <div style={{ maxWidth: 700, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <Trophy size={48} color="var(--color-brand-yellow)" style={{ marginBottom: "0.5rem" }} />
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "3rem", color: "var(--color-text-strong)" }}>
              {phase === 'ended' ? "FINAL CHAMPIONS" : "LEADERBOARD"}
            </h1>
          </div>

          {/* Podium */}
          {sortedParticipants.length >= 3 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "0.75rem", marginBottom: "2rem" }}>
              {[sortedParticipants[1], sortedParticipants[0], sortedParticipants[2]].map((p, i) => {
                const heights = ["120px", "160px", "100px"];
                const colors = ["var(--color-brand-blue)", "var(--color-brand-yellow)", "var(--color-brand-green)"];
                const badges = ["🥈", "🥇", "🥉"];
                return (
                  <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{p.avatar} {p.nickname}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--color-text-muted)" }}>{p.score} pts</div>
                    <div style={{
                      width: "90px",
                      height: heights[i],
                      background: colors[i],
                      border: "var(--border-default)",
                      boxShadow: "var(--shadow-sm)",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: "0.5rem",
                      fontFamily: "var(--font-display)",
                      fontSize: "2rem",
                      borderRadius: "8px 8px 0 0",
                    }}>
                      {badges[i]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Participant List */}
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {sortedParticipants.map((p, idx) => (
              <div key={p.id} className="lb-row" style={idx === 0 ? { background: "var(--color-brand-yellow)", boxShadow: "var(--shadow-md)" } : {}}>
                <div className="lb-rank">#{idx + 1}</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", flex: 1 }}>{p.avatar} {p.nickname}</div>
                <div className="lb-points">{p.score} <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>pts</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active question / Reveal phase
  const optionCounts = (currentSlide.options || []).map((opt: any) => {
    const count = responses.filter((r) => r.selected_option_id === opt.id).length;
    return { ...opt, count };
  });
  const maxVoteCount = Math.max(...optionCounts.map((o: any) => o.count), 1);

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0.75rem 1.5rem",
          borderBottom: "var(--border-default)",
          background: "var(--color-surface)",
          boxShadow: "0 3px 0 0 var(--color-shadow)",
          flexWrap: "wrap",
        }}
      >
        <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>

        <div className="phase-badge" style={{ background: phase === 'preview' ? "var(--color-brand-blue)" : phase === 'live' ? "var(--color-brand-yellow)" : "var(--color-brand-green)", color: phase === 'preview' ? "#fff" : "#000" }}>
          {isOpeningCountdown ? 'STARTING QUIZ' : phase === 'preview' ? 'QUESTION PREVIEW' : phase.toUpperCase()}
        </div>

        <div className="session-code" style={{ fontSize: "1.4rem", padding: "0.25rem 0.75rem" }}>
          {session.session_code}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginLeft: "auto" }}>
          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
            Q {currentSlideIdx + 1} / {slides.length}
          </span>
        </div>
      </header>

      {/* Main question and live results */}
      <main style={{ maxWidth: 900, margin: "0 auto", width: "100%", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Timer and responses bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {phase === 'preview' ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "var(--color-brand-blue)", color: "#fff", padding: "0.55rem 1.2rem", borderRadius: 10, border: "2px solid #000", boxShadow: "var(--shadow-sm)" }}>
              <Eye size={20} />
              <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                {isOpeningCountdown ? `Starting quiz in ${previewTimeLeft}s` : `Previewing Media & Question — Options unlock in ${previewTimeLeft}s`}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Clock size={20} color="var(--color-accent-amber)" />
              <span style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", color: timeLeft <= 5 ? "#ef4444" : "var(--color-text-strong)" }}>
                {timeLeft}s
              </span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Users size={18} />
            <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>
              {responses.length} / {participants.length} Answered
            </span>
          </div>
        </div>

        {/* Question Header Card */}
        <div className="pin-card" style={{ padding: "1.8rem", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(1.3rem, 3vw, 2rem)", fontFamily: "var(--font-display)", color: "var(--color-text-strong)" }}>
            {currentSlide.question}
          </h2>
          {currentSlide.media_url && (
            <div style={{ marginTop: "1.2rem", display: "flex", justifyContent: "center" }}>
              {currentSlide.media_type === "video" || currentSlide.media_url.match(/\.(mp4|webm)$/i) ? (
                <video
                  src={currentSlide.media_url}
                  controls
                  autoPlay
                  loop
                  muted
                  style={{ maxHeight: 280, maxWidth: "100%", borderRadius: 8, border: "2px solid #000" }}
                />
              ) : (
                <img
                  src={currentSlide.media_url}
                  alt="Question Media"
                  style={{ maxHeight: 280, maxWidth: "100%", objectFit: "contain", borderRadius: 8, border: "2px solid #000" }}
                />
              )}
            </div>
          )}
        </div>

        {/* Options / Live Bar Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {optionCounts.map((opt, i) => {
            const isCorrect = opt.is_correct;
            const pct = Math.round((opt.count / (responses.length || 1)) * 100);
            return (
              <div
                key={opt.id || i}
                className="pin-card"
                style={{
                  padding: "1rem 1.2rem",
                  borderColor: phase === 'reveal' && isCorrect ? "#16a34a" : undefined,
                  background: phase === 'reveal' && isCorrect ? "rgba(34,197,94,0.15)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: OPTION_COLORS[i % OPTION_COLORS.length],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display)",
                      border: "2px solid #000",
                      flexShrink: 0,
                    }}
                  >
                    {OPTION_LABELS[i]}
                  </span>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: "1.05rem" }}>
                    {opt.text}
                    {phase === 'reveal' && isCorrect && (
                      <span style={{ marginLeft: "0.6rem", color: "#16a34a", fontSize: "0.85rem", fontWeight: 800 }}>
                        ✓ Correct Answer
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", minWidth: 40, textAlign: "right" }}>
                    {opt.count}
                  </div>
                </div>

                {/* Response distribution fill bar */}
                <div style={{ height: 6, background: "var(--color-border-subtle)", borderRadius: 3, marginTop: "0.6rem", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: phase === 'reveal' && isCorrect ? "#16a34a" : "var(--color-accent-amber)", transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Host Footer Action Toolbar */}
      <footer style={{ padding: "1rem 1.5rem", borderTop: "var(--border-default)", background: "var(--color-surface)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.8rem" }}>
        <StatChip value={participants.length} label="Total Audience" />
        <div style={{ display: "flex", gap: "0.8rem" }}>
          {phase === 'preview' && (
            <button className="btn btn-green" onClick={handleUnlockOptions}>
              <Zap size={16} /> Unlock Options Now ({previewTimeLeft}s)
            </button>
          )}
          {phase === 'live' && (
            <>
              <button className="btn btn-secondary" onClick={simulateBotAnswersForCurrentSlide}>
                🤖 Auto-Fill 200 Votes
              </button>
              <button className="btn btn-yellow" onClick={handleRevealAnswer}>
                Reveal Answers
              </button>
            </>
          )}
          {phase === 'reveal' && (
            <button className="btn btn-green" onClick={handleShowLeaderboard}>
              <Trophy size={16} /> Show Leaderboard
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
