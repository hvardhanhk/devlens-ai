import { useState, useReducer, useRef, useEffect, useCallback } from "react";

// ─── Sample code with intentional issues for demo ───────────────────────────
const DEFAULT_CODE = `import { useState, useEffect } from 'react';

function useUserData(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(\`/api/users/\${userId}\`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []); // ⚠ Missing userId dependency

  return { data, loading };
}

export function UserProfile({ userId, onDelete }) {
  const { data, loading } = useUserData(userId);
  const [count, setCount] = useState(0);

  // ⚠ Direct DOM manipulation — React anti-pattern
  const handleClick = () => {
    document.getElementById('user-name').innerHTML = data.name;
    setCount(count + 1);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div onClick={handleClick}>
      <h1 id="user-name">{data?.name}</h1>
      <button onClick={() => onDelete(data.id)}>Delete</button>
      <span>Clicks: {count}</span>
    </div>
  );
}`;

// ─── Analysis mode definitions ───────────────────────────────────────────────
const MODES = [
  { id: "performance", label: "Performance", icon: "⚡", color: "#F59E0B" },
  { id: "security",    label: "Security",    icon: "🔒", color: "#F87171" },
  { id: "a11y",        label: "A11y",        icon: "♿", color: "#818CF8" },
  { id: "typescript",  label: "TypeScript",  icon: "◈",  color: "#38BDF8" },
  { id: "architecture",label: "Architecture",icon: "⬡",  color: "#2DD4BF" },
];

const SYSTEM_PROMPTS = {
  performance: `You are a senior frontend performance engineer reviewing React/JavaScript code.
Analyze for: unnecessary re-renders, missing memoization, stale closures, expensive renders, effect dependency bugs, memory leaks.
Format your response EXACTLY as:
## Overview
[2-sentence summary of overall performance health]

## Issues Found
**[CRITICAL]** Issue Title Here
Explanation and recommended fix.

**[WARNING]** Issue Title Here
Explanation and recommended fix.

**[INFO]** Issue Title Here
Explanation and recommended fix.

## Recommendations
[1-2 actionable next steps]

SCORE: [0-100]`,

  security: `You are an expert frontend security engineer reviewing React/JavaScript code.
Analyze for: XSS vulnerabilities, unsafe innerHTML, injection risks, data exposure, missing sanitization.
Format your response EXACTLY as:
## Overview
[2-sentence summary of security posture]

## Issues Found
**[CRITICAL]** Issue Title Here
Explanation and recommended fix.

**[WARNING]** Issue Title Here
Explanation and recommended fix.

**[INFO]** Issue Title Here
Explanation and recommended fix.

## Recommendations
[1-2 actionable next steps]

SCORE: [0-100]`,

  a11y: `You are a web accessibility expert (WCAG 2.1 AA). Review the provided React code.
Analyze for: missing ARIA labels, keyboard navigation gaps, focus management, semantic HTML, screen reader support.
Format your response EXACTLY as:
## Overview
[2-sentence summary of accessibility compliance]

## Issues Found
**[CRITICAL]** Issue Title Here
Explanation and recommended fix.

**[WARNING]** Issue Title Here
Explanation and recommended fix.

**[INFO]** Issue Title Here
Explanation and recommended fix.

## Recommendations
[1-2 actionable next steps]

SCORE: [0-100]`,

  typescript: `You are a TypeScript expert reviewing JavaScript/TypeScript code.
Analyze for: missing types, implicit any, unsafe type assertions, missing generics, interface improvements.
Format your response EXACTLY as:
## Overview
[2-sentence summary of type safety state]

## Issues Found
**[CRITICAL]** Issue Title Here
Explanation and recommended fix.

**[WARNING]** Issue Title Here
Explanation and recommended fix.

**[INFO]** Issue Title Here
Explanation and recommended fix.

## Recommendations
[1-2 actionable next steps]

SCORE: [0-100]`,

  architecture: `You are a senior frontend architect reviewing React code for architectural quality.
Analyze for: separation of concerns, component coupling, hook design, SOLID principles, data flow.
Format your response EXACTLY as:
## Overview
[2-sentence summary of architectural quality]

## Issues Found
**[CRITICAL]** Issue Title Here
Explanation and recommended fix.

**[WARNING]** Issue Title Here
Explanation and recommended fix.

**[INFO]** Issue Title Here
Explanation and recommended fix.

## Recommendations
[1-2 actionable next steps]

SCORE: [0-100]`,
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
const initialState = {
  code: DEFAULT_CODE,
  mode: "performance",
  isAnalyzing: false,
  streamedContent: "",
  score: null,
  error: null,
  analysisComplete: false,
  issueCount: { critical: 0, warning: 0, info: 0 },
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CODE":
      return { ...state, code: action.payload };
    case "SET_MODE":
      return { ...state, mode: action.payload, streamedContent: "", score: null, analysisComplete: false, error: null, issueCount: { critical: 0, warning: 0, info: 0 } };
    case "START_ANALYSIS":
      return { ...state, isAnalyzing: true, streamedContent: "", score: null, error: null, analysisComplete: false, issueCount: { critical: 0, warning: 0, info: 0 } };
    case "APPEND_CONTENT": {
      const newContent = state.streamedContent + action.payload;
      const critical = (newContent.match(/\*\*\[CRITICAL\]\*\*/gi) || []).length;
      const warning  = (newContent.match(/\*\*\[WARNING\]\*\*/gi)  || []).length;
      const info     = (newContent.match(/\*\*\[INFO\]\*\*/gi)     || []).length;
      const scoreMatch = newContent.match(/SCORE:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : state.score;
      return { ...state, streamedContent: newContent, issueCount: { critical, warning, info }, score };
    }
    case "COMPLETE":
      return { ...state, isAnalyzing: false, analysisComplete: true };
    case "ERROR":
      return { ...state, isAnalyzing: false, error: action.payload };
    default:
      return state;
  }
}

// ─── Custom streaming hook ────────────────────────────────────────────────────
function useStreamingAnalysis(state, dispatch) {
  const abortRef = useRef(null);

  const analyze = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    dispatch({ type: "START_ANALYSIS" });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          stream: true,
          system: SYSTEM_PROMPTS[state.mode],
          messages: [{ role: "user", content: `Analyze this code:\n\`\`\`tsx\n${state.code}\n\`\`\`` }],
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              dispatch({ type: "APPEND_CONTENT", payload: parsed.delta.text });
            }
          } catch { /* ignore */ }
        }
      }
      dispatch({ type: "COMPLETE" });
    } catch (err) {
      if (err.name !== "AbortError") dispatch({ type: "ERROR", payload: err.message });
    }
  }, [state.code, state.mode, dispatch]);

  return analyze;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (score === null) return;
    let cur = 0;
    const step = score / 50;
    const t = setInterval(() => {
      cur = Math.min(cur + step, score);
      setDisplay(Math.round(cur));
      if (cur >= score) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [score]);

  if (score === null) return null;
  const color = score >= 80 ? "#34D399" : score >= 55 ? "#FBBF24" : "#F87171";
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - display / 100);

  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="#1A2E48" strokeWidth={5} />
        <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.02s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color, fontSize: 16, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", lineHeight: 1 }}>{display}</span>
        <span style={{ color: "#3A5570", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1 }}>score</span>
      </div>
    </div>
  );
}

// ─── Analysis content renderer ────────────────────────────────────────────────
function AnalysisContent({ content, isStreaming }) {
  if (!content) return null;
  const lines = content.split("\n");

  return (
    <div>
      {lines.map((line, i) => {
        if (line.startsWith("SCORE:")) return null;

        if (line.includes("**[CRITICAL]**")) {
          const title = line.replace("**[CRITICAL]**", "").replace(/\*\*/g, "").trim();
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "14px 0 4px" }}>
              <span style={{ background: "#2D0E0E", color: "#FCA5A5", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3, letterSpacing: "0.07em", border: "1px solid #F8717140", fontFamily: "IBM Plex Mono, monospace", flexShrink: 0, marginTop: 1 }}>CRITICAL</span>
              <span style={{ color: "#F1F5F9", fontWeight: 600, fontSize: 13, lineHeight: "1.5" }}>{title}</span>
            </div>
          );
        }
        if (line.includes("**[WARNING]**")) {
          const title = line.replace("**[WARNING]**", "").replace(/\*\*/g, "").trim();
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "14px 0 4px" }}>
              <span style={{ background: "#221A09", color: "#FCD34D", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3, letterSpacing: "0.07em", border: "1px solid #FBBF2440", fontFamily: "IBM Plex Mono, monospace", flexShrink: 0, marginTop: 1 }}>WARNING</span>
              <span style={{ color: "#F1F5F9", fontWeight: 600, fontSize: 13, lineHeight: "1.5" }}>{title}</span>
            </div>
          );
        }
        if (line.includes("**[INFO]**")) {
          const title = line.replace("**[INFO]**", "").replace(/\*\*/g, "").trim();
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "14px 0 4px" }}>
              <span style={{ background: "#0A1828", color: "#93C5FD", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3, letterSpacing: "0.07em", border: "1px solid #60A5FA40", fontFamily: "IBM Plex Mono, monospace", flexShrink: 0, marginTop: 1 }}>INFO</span>
              <span style={{ color: "#F1F5F9", fontWeight: 600, fontSize: 13, lineHeight: "1.5" }}>{title}</span>
            </div>
          );
        }
        if (line.startsWith("## ")) {
          return <h3 key={i} style={{ color: "#2DD4BF", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "18px 0 8px", fontFamily: "IBM Plex Mono, monospace", paddingBottom: 6, borderBottom: "1px solid #1A2E48" }}>{line.slice(3)}</h3>;
        }
        if (!line.trim()) return <div key={i} style={{ height: 5 }} />;
        if (line.includes("**")) {
          const parts = line.split("**");
          return (
            <p key={i} style={{ margin: "3px 0", color: "#7A93B0", fontSize: 13, lineHeight: "1.65" }}>
              {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#CBD5E1" }}>{p}</strong> : p)}
            </p>
          );
        }
        return <p key={i} style={{ margin: "3px 0", color: "#7A93B0", fontSize: 13, lineHeight: "1.65" }}>{line}</p>;
      })}
      {isStreaming && (
        <span style={{ display: "inline-block", width: 7, height: 14, background: "#2DD4BF", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 0.75s step-end infinite" }} />
      )}
    </div>
  );
}

const SKILLS = [
  "LLM API Integration", "SSE Streaming", "useReducer", "Custom Hooks",
  "Real-time UI", "TypeScript", "React Patterns", "Anthropic SDK",
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const analyze = useStreamingAnalysis(state, dispatch);
  const resultsRef = useRef(null);
  const lineCount = state.code.split("\n").length;
  const activeMode = MODES.find(m => m.id === state.mode);

  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
    }
  }, [state.streamedContent]);

  const totalIssues = state.issueCount.critical + state.issueCount.warning + state.issueCount.info;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E3250; border-radius: 2px; }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0}   }
        @keyframes slideUp{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .tab-btn { transition: all 0.15s ease; }
        .tab-btn:hover { color: #C8D8E8 !important; background: #132030 !important; }
        .run-btn  { transition: background 0.15s ease, transform 0.1s ease; }
        .run-btn:hover:not(:disabled)  { background: #25C2AF !important; transform: translateY(-1px); }
        .run-btn:active:not(:disabled) { transform: translateY(0); }
        .run-btn:disabled { opacity: .5; cursor: not-allowed; }
        .code-ta { resize: none !important; outline: none !important; caret-color: #2DD4BF; }
        .code-ta::selection { background: #163655; }
      `}</style>

      <div style={{ fontFamily: "IBM Plex Sans, sans-serif", background: "#09111D", minHeight: "100vh", color: "#E2EBF5", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 52, borderBottom: "1px solid #142030", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0C1625", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg, #2DD4BF 0%, #0891B2 100%)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⬡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>DevLens <span style={{ color: "#2DD4BF" }}>AI</span></div>
              <div style={{ fontSize: 9, color: "#2A4565", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Code Intelligence</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {state.isAnalyzing && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, animation: "fadeIn .2s ease" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2DD4BF", animation: "pulse 1.2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, color: "#2DD4BF", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.08em" }}>ANALYZING</span>
              </div>
            )}
            {state.analysisComplete && !state.isAnalyzing && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, animation: "fadeIn .3s ease" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399" }} />
                <span style={{ fontSize: 10, color: "#34D399", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.08em" }}>COMPLETE</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 5 }}>
              {state.issueCount.critical > 0 && <span style={{ background: "#2D0E0E", color: "#FCA5A5", fontSize: 10, padding: "2px 9px", borderRadius: 20, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, border: "1px solid #F8717125" }}>{state.issueCount.critical} critical</span>}
              {state.issueCount.warning  > 0 && <span style={{ background: "#221A09", color: "#FCD34D", fontSize: 10, padding: "2px 9px", borderRadius: 20, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, border: "1px solid #FBBF2425" }}>{state.issueCount.warning} warn</span>}
              {state.issueCount.info     > 0 && <span style={{ background: "#0A1828", color: "#93C5FD", fontSize: 10, padding: "2px 9px", borderRadius: 20, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, border: "1px solid #60A5FA25" }}>{state.issueCount.info} info</span>}
            </div>
          </div>
        </header>

        <div style={{ height: 44, borderBottom: "1px solid #142030", padding: "0 20px", display: "flex", alignItems: "center", gap: 4, background: "#0C1625", flexShrink: 0 }}>
          {MODES.map(m => (
            <button key={m.id} className="tab-btn"
              onClick={() => dispatch({ type: "SET_MODE", payload: m.id })}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif", fontWeight: 500, whiteSpace: "nowrap", background: state.mode === m.id ? "#132A44" : "transparent", color: state.mode === m.id ? m.color : "#3D5870", borderBottom: `2px solid ${state.mode === m.id ? m.color : "transparent"}` }}>
              <span style={{ fontSize: 13 }}>{m.icon}</span>{m.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="run-btn" onClick={analyze} disabled={state.isAnalyzing}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 20px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, letterSpacing: "0.07em", background: "#2DD4BF", color: "#07111E" }}>
            {state.isAnalyzing ? <><span style={{ animation: "pulse 1s infinite" }}>●</span> ANALYZING…</> : <>▶ RUN ANALYSIS</>}
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <div style={{ width: "50%", display: "flex", flexDirection: "column", borderRight: "1px solid #142030" }}>
            <div style={{ height: 34, padding: "0 14px", borderBottom: "1px solid #142030", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0B1421", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171", display: "inline-block" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBBF24", display: "inline-block" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399", display: "inline-block" }} />
                <span style={{ marginLeft: 8, fontSize: 11, color: "#2A4565", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.04em" }}>UserProfile.tsx</span>
              </div>
              <span style={{ fontSize: 10, color: "#1E3452", fontFamily: "IBM Plex Mono, monospace" }}>{lineCount} lines</span>
            </div>
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div style={{ width: 42, background: "#0B1421", borderRight: "1px solid #0F1E30", flexShrink: 0, overflow: "hidden", padding: "13px 0", userSelect: "none" }}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} style={{ height: 20, lineHeight: "20px", textAlign: "right", paddingRight: 10, fontSize: 11, color: "#1E3452", fontFamily: "IBM Plex Mono, monospace" }}>{i + 1}</div>
                ))}
              </div>
              <textarea className="code-ta"
                value={state.code}
                onChange={e => dispatch({ type: "SET_CODE", payload: e.target.value })}
                spellCheck={false}
                style={{ flex: 1, padding: "13px 16px", background: "#09111D", color: "#B8D0E8", fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5, lineHeight: "20px", border: "none", resize: "none", outline: "none", overflow: "auto", tabSize: 2 }}
              />
            </div>
          </div>

          <div style={{ width: "50%", display: "flex", flexDirection: "column" }}>
            <div style={{ height: 34, padding: "0 16px", borderBottom: "1px solid #142030", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0B1421", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "#2A4565", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.06em" }}>
                ANALYSIS · <span style={{ color: activeMode?.color }}>{activeMode?.label.toUpperCase()}</span>
              </span>
              {state.score !== null && <ScoreRing score={state.score} />}
            </div>

            <div ref={resultsRef} style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
              {!state.streamedContent && !state.isAnalyzing && !state.error && (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, opacity: .35 }}>
                  <div style={{ fontSize: 44, lineHeight: 1 }}>{activeMode?.icon}</div>
                  <div style={{ fontSize: 12, color: "#3A5570", textAlign: "center", fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.7 }}>
                    Click <strong style={{ color: "#4A6580" }}>RUN ANALYSIS</strong><br />to detect issues
                  </div>
                </div>
              )}
              {state.error && (
                <div style={{ padding: "12px 16px", background: "#2D0E0E", border: "1px solid #F8717130", borderRadius: 6, color: "#FCA5A5", fontSize: 12, fontFamily: "IBM Plex Mono, monospace", animation: "slideUp .25s ease" }}>
                  ⚠ {state.error}
                </div>
              )}
              {state.streamedContent && (
                <div style={{ animation: "slideUp .2s ease" }}>
                  <AnalysisContent content={state.streamedContent} isStreaming={state.isAnalyzing} />
                </div>
              )}
            </div>

            {totalIssues > 0 && (
              <div style={{ borderTop: "1px solid #142030", padding: "10px 22px", display: "flex", alignItems: "center", background: "#0B1421", flexShrink: 0 }}>
                {[
                  { label: "Critical", count: state.issueCount.critical, color: "#F87171" },
                  { label: "Warnings", count: state.issueCount.warning,  color: "#FBBF24" },
                  { label: "Info",     count: state.issueCount.info,     color: "#60A5FA" },
                ].map((m, i) => m.count > 0 && (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 18px", borderRight: i < 2 ? "1px solid #142030" : "none", paddingLeft: i === 0 ? 0 : 18 }}>
                    <div style={{ width: 3, height: 30, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "IBM Plex Mono, monospace", lineHeight: 1 }}>{m.count}</div>
                      <div style={{ fontSize: 9, color: "#2A4565", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{m.label}</div>
                    </div>
                  </div>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 10, color: "#1E3452", fontFamily: "IBM Plex Mono, monospace" }}>{totalIssues} issue{totalIssues !== 1 ? "s" : ""} found</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #0F1E30", padding: "8px 20px", background: "#07101A", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, overflowX: "auto" }}>
          <span style={{ fontSize: 9, color: "#1E3452", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", marginRight: 4 }}>Skills demonstrated</span>
          {SKILLS.map(s => (
            <span key={s} style={{ fontSize: 10, color: "#2A5060", border: "1px solid #1A3040", borderRadius: 3, padding: "2px 8px", whiteSpace: "nowrap", fontFamily: "IBM Plex Mono, monospace" }}>{s}</span>
          ))}
        </div>
      </div>
    </>
  );
}
