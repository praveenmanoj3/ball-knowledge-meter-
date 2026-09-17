"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Clock, Zap, Trophy, Loader2, Eye, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSession, submitParticipantResponse } from "@/lib/api";
import { Session, Slide, Participant } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
  "var(--color-brand-blue)",
  "var(--color-brand-green)",
  "var(--color-brand-yellow)",
  "var(--color-brand-pink)",
];

export default function PlaySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantReady, setParticipantReady] = useState(false);
  const [nickname, setNickname] = useState<string>("Player");
  const [avatar, setAvatar] = useState<string>("🐝");

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);
  const submittingAnswerRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);

  // Restore player session storage
  useEffect(() => {
    const pId = sessionStorage.getItem("bkm_participant_id");
    const nick = sessionStorage.getItem("bkm_nickname");
    const av = sessionStorage.getItem("bkm_avatar");

    if (pId) setParticipantId(pId);
    if (nick) setNickname(nick);
    if (av) setAvatar(av);
    setParticipantReady(true);
  }, []);

  // Fetch initial session state
  useEffect(() => {
    async function init() {
      const data = await getSession(sessionId);
      if (data) {
        setSession(data.session);
        sessionRef.current = data.session;
        setSlides(data.slides);
        setParticipants(data.participants);
      }
      setLoading(false);
    }
    init();
  }, [sessionId]);

  // Subscribe to Realtime session updates
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`play-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updatedSession = payload.new as Session;
          const previousSession = sessionRef.current;
          const isNewSlide = previousSession !== null && previousSession.current_slide_index !== updatedSession.current_slide_index;
          const isNewLivePhase = previousSession !== null && previousSession.status !== "live" && updatedSession.status === "live";
          sessionRef.current = updatedSession;
          setSession(updatedSession);

          // Reset only when a new question becomes live, not on unrelated session writes.
          if (updatedSession.status === "live" && (isNewSlide || isNewLivePhase)) {
            setSelectedOptionId(null);
            setIsSubmitted(false);
            setEarnedPoints(0);
            setIsCorrectAnswer(null);
            submittingAnswerRef.current = false;
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        async () => {
          // Re-fetch participants for leaderboard update
          const data = await getSession(sessionId);
          if (data) setParticipants(data.participants);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const currentSlide = slides[session?.current_slide_index || 0] || slides[0];
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (session?.status !== "preview") return;
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(interval);
  }, [session?.status]);

  const previewCountdown =
    session?.status === "preview" && currentSlide
      ? Math.max(0, Math.ceil((currentSlide.preview_time ?? 5) - ((nowMs - new Date(session.phase_started_at).getTime()) / 1000)))
      : 0;

  useEffect(() => {
    const currentIndex = session?.current_slide_index || 0;
    const slidesToWarm = [slides[currentIndex], slides[currentIndex + 1]];
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
  }, [session?.current_slide_index, slides]);

  // Check if player already submitted an answer for current slide (persisted in sessionStorage)
  useEffect(() => {
    if (!currentSlide || !sessionId) return;
    const key = `bkm_ans_${sessionId}_${currentSlide.id}`;
    const savedOpt = sessionStorage.getItem(key);
    if (savedOpt) {
      setSelectedOptionId(savedOpt);
      setIsSubmitted(true);
      const chosen = currentSlide.options?.find((o) => o.id === savedOpt);
      if (chosen) {
        setIsCorrectAnswer(chosen.is_correct);
      }
    }
  }, [sessionId, session?.current_slide_index, currentSlide?.id]);

  const handleSelectAnswer = async (optionId: string) => {
    if (!participantReady || isSubmitted || submittingAnswerRef.current || session?.status !== "live" || !session || !currentSlide || !participantId) return;

    submittingAnswerRef.current = true;

    setSelectedOptionId(optionId);
    setIsSubmitted(true);
    sessionStorage.setItem(`bkm_ans_${sessionId}_${currentSlide.id}`, optionId);

    const chosenOption = currentSlide.options.find((o) => o.id === optionId);
    const correct = chosenOption?.is_correct || false;

    // Calculate response time from server phase_started_at
    const startMs = new Date(session.phase_started_at).getTime();
    const nowMs = Date.now();
    const responseTimeMs = Math.max(0, nowMs - startMs);

    // Speed bonus calculation: 1000 base pts + up to 500 speed bonus
    let points = 0;
    if (correct) {
      const totalLimitMs = (currentSlide.time_limit || 20) * 1000;
      const speedRatio = Math.max(0, 1 - responseTimeMs / totalLimitMs);
      points = Math.round(1000 + speedRatio * 500);
    }

    setIsCorrectAnswer(correct);
    setEarnedPoints(points);

    const submitted = await submitParticipantResponse(
      sessionId,
      currentSlide.id,
      participantId,
      optionId,
      correct,
      responseTimeMs,
      points
    );

    if (!submitted) {
      const stillSameLiveQuestion = session?.status === "live" && session.current_slide_id === currentSlide.id;
      if (stillSameLiveQuestion) {
        sessionStorage.removeItem(`bkm_ans_${sessionId}_${currentSlide.id}`);
        setSelectedOptionId(null);
        setIsSubmitted(false);
      }
    }
    submittingAnswerRef.current = false;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div className="pin-card" style={{ padding: "2rem 3rem", textAlign: "center" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 1rem", color: "var(--color-accent-amber)" }} />
          <p style={{ fontWeight: 800, margin: 0 }}>Joining Arena...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <h2>Session not found</h2>
        <button onClick={() => router.push("/join")} className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Enter Session Code
        </button>
      </div>
    );
  }

  // 1. Lobby Waiting Screen
  if (session.status === "lobby") {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "var(--border-default)", background: "var(--color-surface)" }}>
          <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>
          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{avatar} {nickname}</span>
        </header>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "1.5rem", padding: "2rem", textAlign: "center" }}>
          <div
            style={{
              width: "5rem",
              height: "5rem",
              border: "var(--border-default)",
              background: "var(--color-brand-yellow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Zap size={32} />
          </div>

          <div>
            <h1 style={{ margin: "0 0 0.5rem", fontFamily: "var(--font-display)", fontSize: "2.3rem", color: "var(--color-text-strong)" }}>
              YOU'RE IN!
            </h1>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontWeight: 700, fontSize: "1rem" }}>
              Waiting for the host to start the game…
            </p>
          </div>

          <div
            className="session-code"
            style={{ fontSize: "1.8rem", padding: "0.4rem 1.2rem" }}
          >
            PIN: {session.session_code}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#16a34a" }}>Live Realtime Connected</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Leaderboard & Ended Screen
  if (session.status === "leaderboard" || session.status === "ended") {
    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === participantId) + 1;
    const myParticipant = participants.find((p) => p.id === participantId);

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "var(--border-default)", background: "var(--color-surface)" }}>
          <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>
          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{avatar} {nickname}</span>
        </header>

        <div style={{ maxWidth: 500, margin: "0 auto", width: "100%", padding: "2rem 1.2rem" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <Trophy size={40} color="var(--color-brand-yellow)" style={{ marginBottom: "0.4rem" }} />
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "2.4rem" }}>
              {session.status === "ended" ? "FINAL STANDINGS" : "LEADERBOARD"}
            </h1>
            {myRank > 0 && (
              <p style={{ margin: "0.4rem 0 0", fontWeight: 800, fontSize: "1.1rem", color: "var(--color-accent-amber)" }}>
                You are Ranked #{myRank} ({myParticipant?.score || 0} pts)
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {sorted.slice(0, 10).map((p, idx) => {
              const isMe = p.id === participantId;
              return (
                <div
                  key={p.id}
                  className="lb-row"
                  style={{
                    background: isMe ? "var(--color-brand-yellow)" : undefined,
                    borderColor: isMe ? "#000" : undefined,
                    fontWeight: isMe ? 800 : 600,
                  }}
                >
                  <div className="lb-rank">#{idx + 1}</div>
                  <div style={{ flex: 1, fontSize: "0.95rem" }}>{p.avatar} {p.nickname} {isMe && "(You)"}</div>
                  <div className="lb-points">{p.score} <span style={{ fontSize: "0.75rem" }}>pts</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 3. Reveal phase
  if (session.status === "reveal") {
    const correctOpt = currentSlide.options.find((o) => o.is_correct);
    const chosenOpt = currentSlide.options.find((o) => o.id === selectedOptionId);
    const isCorrect = isCorrectAnswer === true;

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "var(--border-default)", background: "var(--color-surface)" }}>
          <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>
          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{avatar} {nickname}</span>
        </header>

        <main style={{ maxWidth: 500, margin: "0 auto", width: "100%", padding: "2rem 1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            className="animate-scale-in"
            style={{
              padding: "1.5rem",
              border: "var(--border-default)",
              background: isCorrect ? "var(--color-brand-green)" : "var(--color-brand-pink)",
              boxShadow: "var(--shadow-lg)",
              textAlign: "center",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "0.3rem" }}>{isCorrect ? "🎯" : "❌"}</div>
            <h2 style={{ margin: "0 0 0.3rem", fontFamily: "var(--font-display)", fontSize: "2.2rem", color: "#fff" }}>
              {isCorrect ? "CORRECT!" : "WRONG ANSWER"}
            </h2>
            {isCorrect && (
              <p style={{ margin: 0, color: "rgba(255,255,255,0.9)", fontWeight: 800, fontSize: "1.2rem" }}>
                +{earnedPoints} points!
              </p>
            )}
          </div>

          {/* Correct answer reminder */}
          <div className="pin-card" style={{ padding: "1.2rem" }}>
            <p style={{ margin: "0 0 0.3rem", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
              Correct Answer
            </p>
            <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#16a34a" }}>
              ✓ {correctOpt?.text}
            </p>
          </div>

          <div className="pin-card" style={{ padding: "1rem", textAlign: "center" }}>
            <Clock size={18} style={{ margin: "0 auto 0.3rem", color: "var(--color-text-muted)" }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
              Waiting for host to continue…
            </p>
          </div>
        </main>
      </div>
    );
  }

  // 4. Live Question Screen
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "var(--border-default)", background: "var(--color-surface)" }}>
        <div className="brand"><div className="brand__mark" /><span className="brand__text">BKM</span></div>
        <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{avatar} {nickname}</span>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", width: "100%", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem", flex: 1 }}>
        {/* Question text */}
        <div className="pin-card" style={{ padding: "1.5rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
            Question {(session.current_slide_index || 0) + 1} of {slides.length}
          </p>
          <h2 style={{ margin: 0, fontSize: "clamp(1.2rem, 4vw, 1.6rem)", fontFamily: "var(--font-display)", color: "var(--color-text-strong)" }}>
            {currentSlide.question}
          </h2>
          {currentSlide.media_url && (
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
              {currentSlide.media_type === "video" || currentSlide.media_url.match(/\.(mp4|webm)$/i) ? (
                <video
                  src={currentSlide.media_url}
                  controls
                  autoPlay
                  loop
                  muted
                  style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 8, border: "2px solid #000" }}
                />
              ) : (
                <img
                  src={currentSlide.media_url}
                  alt="Question Media"
                  style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain", borderRadius: 8, border: "2px solid #000" }}
                />
              )}
            </div>
          )}
        </div>

        {/* Preview Banner or Options */}
        {session.status === "preview" ? (
          <div
            className="pin-card animate-scale-in"
            style={{
              padding: "1.8rem 1.2rem",
              textAlign: "center",
              background: "var(--color-brand-blue)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              borderRadius: 12,
            }}
          >
            <Eye size={36} color="#fff" />
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.5rem" }}>
              {session.current_slide_index === 0 ? `Starting quiz in ${previewCountdown}s` : "LOOK AT THE SCREEN!"}
            </h3>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "rgba(255,255,255,0.9)" }}>
              {session.current_slide_index === 0
                ? "Get ready. The first question is about to begin."
                : "Read the question & watch the media. Options will unlock in a few seconds…"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", flex: 1 }}>
            {/* Status indicator when answer is locked in */}
            {isSubmitted && (
              <div
                className="pin-card animate-scale-in"
                style={{
                  padding: "0.75rem 1rem",
                  textAlign: "center",
                  background: "var(--color-brand-yellow)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <CheckCircle size={18} color="var(--color-text-strong)" />
                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--color-text-strong)" }}>
                  Answer locked in! Waiting for host to reveal…
                </span>
              </div>
            )}

            {/* Answer Options Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
              {(currentSlide.options || []).map((opt, i) => {
                const isThisSelected = opt.id === selectedOptionId;
                const isAnySelected = isSubmitted && selectedOptionId !== null;

                // Base style: if submitted, unselected choices turn BLACK & WHITE
                let optionClassName = "answer-option";
                if (isAnySelected) {
                  optionClassName += isThisSelected
                    ? " answer-option--selected-active"
                    : " answer-option--unselected-bw";
                }

                return (
                  <button
                    key={opt.id || i}
                    className={optionClassName}
                    disabled={!participantReady || isSubmitted || !participantId || session.status !== "live"}
                    onClick={() => handleSelectAnswer(opt.id)}
                    style={{
                      background: isAnySelected && !isThisSelected
                        ? undefined // CSS class applies black-and-white grayscale
                        : OPTION_COLORS[i % OPTION_COLORS.length],
                      minHeight: "60px",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                      <span className="answer-key">
                        {OPTION_LABELS[i]}
                      </span>
                      <span style={{ wordBreak: "break-word" }}>{opt.text}</span>
                    </div>

                    {/* Selected badge */}
                    {isThisSelected && (
                      <span
                        style={{
                          background: "#000",
                          color: "#fff",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          padding: "0.25rem 0.6rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          flexShrink: 0,
                        }}
                      >
                        ✓ Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
