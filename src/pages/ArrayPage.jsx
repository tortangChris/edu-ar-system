import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import GroceryShelf from "../components/Groceryshelf";

const scenarios = [
  {
    id: "grocery",
    name: "Grocery Shelf",
    environment: "Table Surface",
    icon: "🛒",
    description: "Virtual boxes with index labels (0, 1, 2...)",
    concepts: ["Linear indexing", "Shifting elements on insert/delete"],
    status: "ready",
  },
  {
    id: "seats",
    name: "Student Seat Viewer",
    environment: "Floor Section",
    icon: "💺",
    description: "Row of avatars with assigned seat numbers",
    concepts: ["Random access by index", "Element swapping (Update)"],
    status: "coming",
  },
  {
    id: "todo",
    name: "To-Do List",
    environment: "Desk Surface",
    icon: "✅",
    description: "Rectangular task tiles in strict sequence",
    concepts: ["Appending to end vs inserting at index", "Shifting logic"],
    status: "coming",
  },
];

// ─── AR Readiness Checker ─────────────────────────────────────────────────────
function useARReadiness() {
  const [checks, setChecks] = useState({
    https: { label: "Secure Context (HTTPS)", status: "checking" },
    webxr: { label: "WebXR API Available", status: "checking" },
    ar: { label: "AR Mode Supported", status: "checking" },
    camera: { label: "Camera Permission", status: "idle" },
  });

  useEffect(() => {
    // 1. HTTPS check (instant)
    const isSecure =
      window.isSecureContext || location.hostname === "localhost";
    setChecks((p) => ({
      ...p,
      https: { ...p.https, status: isSecure ? "pass" : "fail" },
    }));

    // 2. WebXR API check
    const hasWebXR = "xr" in navigator;
    setChecks((p) => ({
      ...p,
      webxr: { ...p.webxr, status: hasWebXR ? "pass" : "fail" },
    }));

    // 3. AR session support
    if (hasWebXR) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((supported) =>
          setChecks((p) => ({
            ...p,
            ar: { ...p.ar, status: supported ? "pass" : "fail" },
          })),
        )
        .catch(() =>
          setChecks((p) => ({ ...p, ar: { ...p.ar, status: "fail" } })),
        );
    } else {
      setChecks((p) => ({ ...p, ar: { ...p.ar, status: "fail" } }));
    }
  }, []);

  const checkCamera = async () => {
    setChecks((p) => ({ ...p, camera: { ...p.camera, status: "checking" } }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop()); // release immediately
      setChecks((p) => ({ ...p, camera: { ...p.camera, status: "pass" } }));
    } catch {
      setChecks((p) => ({ ...p, camera: { ...p.camera, status: "fail" } }));
    }
  };

  const allPass = Object.values(checks).every((c) => c.status === "pass");
  const anyFail = Object.values(checks).some((c) => c.status === "fail");

  return { checks, checkCamera, allPass, anyFail };
}

function CheckRow({ label, status }) {
  const icon = {
    checking: (
      <span
        style={{
          animation: "spin 1s linear infinite",
          display: "inline-block",
        }}
      >
        ⟳
      </span>
    ),
    pass: "✅",
    fail: "❌",
    idle: "○",
  }[status];

  const color = {
    checking: "#f39c12",
    pass: "#2ecc71",
    fail: "#e74c3c",
    idle: "rgba(255,255,255,0.3)",
  }[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        background:
          status === "pass"
            ? "rgba(46,204,113,0.08)"
            : status === "fail"
              ? "rgba(231,76,60,0.08)"
              : "rgba(255,255,255,0.03)",
        border: `1px solid ${color}30`,
      }}
    >
      <span style={{ fontSize: 16, minWidth: 20, textAlign: "center" }}>
        {icon}
      </span>
      <span style={{ color: color, fontSize: 13, fontFamily: "monospace" }}>
        {label}
      </span>
    </div>
  );
}

function ARReadinessPanel({ onDismiss }) {
  const { checks, checkCamera, allPass, anyFail } = useARReadiness();

  return (
    <div
      style={{
        background: "rgba(10,22,40,0.95)",
        border: "1px solid rgba(243,156,18,0.3)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ color: "#f39c12", fontWeight: "bold", fontSize: 15 }}>
            📱 AR Readiness Check
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              marginTop: 2,
            }}
          >
            Ensure your device supports WebXR AR before starting
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            color: "rgba(255,255,255,0.4)",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ✕ Close
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {Object.entries(checks).map(([key, { label, status }]) => (
          <CheckRow key={key} label={label} status={status} />
        ))}
      </div>

      {/* Camera button — user must trigger manually (browser security) */}
      {checks.camera.status === "idle" && (
        <button
          onClick={checkCamera}
          style={{
            width: "100%",
            padding: "9px",
            borderRadius: 8,
            border: "1px solid rgba(243,156,18,0.4)",
            background: "rgba(243,156,18,0.1)",
            color: "#f39c12",
            fontWeight: "bold",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 10,
            fontFamily: "monospace",
          }}
        >
          🎥 Check Camera Permission
        </button>
      )}

      {/* Result */}
      {allPass && (
        <div
          style={{
            background: "rgba(46,204,113,0.1)",
            border: "1px solid rgba(46,204,113,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#2ecc71",
            fontSize: 13,
            fontWeight: "bold",
          }}
        >
          ✅ Your device is ready for AR! Click "Enter AR Mode" on the shelf
          below.
        </div>
      )}
      {anyFail && !allPass && (
        <div
          style={{
            background: "rgba(231,76,60,0.1)",
            border: "1px solid rgba(231,76,60,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
          }}
        >
          <div
            style={{ color: "#e74c3c", fontWeight: "bold", marginBottom: 4 }}
          >
            ⚠️ Some checks failed
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)" }}>
            AR requires Android Chrome 81+. iOS Safari does not support WebXR
            AR. The 3D simulation below still works without AR.
          </div>
        </div>
      )}

      {/* Device tips */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 11,
            marginBottom: 6,
          }}
        >
          COMPATIBLE DEVICES
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["✅", "Android + Chrome 81+"],
            ["✅", "Meta Quest 2/3"],
            ["⚠️", "Samsung Internet (partial)"],
            ["❌", "iOS Safari"],
          ].map(([icon, label]) => (
            <span
              key={label}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {icon} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function ArrayPage() {
  const [selectedScenario, setSelectedScenario] = useState("grocery");
  const [showARCheck, setShowARCheck] = useState(false);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
      {/* Spin animation for loading indicator */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-block px-5 py-2 bg-white/10 border-2 border-white/30 rounded-lg text-white no-underline mb-6 transition-all font-medium hover:bg-white/20 hover:border-white/50 hover:-translate-x-1 text-sm"
        >
          ← Back to Home
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl mb-3 font-bold">📦 Array</h1>
            <p className="text-lg opacity-80 max-w-2xl leading-relaxed">
              A collection of elements stored in contiguous memory. Each element
              has a fixed index — explore operations below.
            </p>
          </div>

          {/* AR Check button */}
          <button
            onClick={() => setShowARCheck((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all self-start mt-1
              ${
                showARCheck
                  ? "border-amber-400 bg-amber-400/20 text-amber-300"
                  : "border-white/20 bg-white/10 text-white hover:border-amber-400/50 hover:text-amber-200"
              }`}
          >
            📱 AR Readiness Check
          </button>
        </div>
      </div>

      {/* AR Readiness Panel */}
      {showARCheck && (
        <ARReadinessPanel onDismiss={() => setShowARCheck(false)} />
      )}

      {/* Scenario picker */}
      <div className="flex gap-3 mb-8 flex-wrap">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => s.status === "ready" && setSelectedScenario(s.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
              ${
                s.status === "coming"
                  ? "opacity-40 cursor-not-allowed border-white/10 bg-white/5 text-white/50"
                  : selectedScenario === s.id
                    ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
                    : "border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15"
              }`}
          >
            <span>{s.icon}</span>
            <span>{s.name}</span>
            {s.status === "coming" && (
              <span className="text-xs opacity-60">(soon)</span>
            )}
          </button>
        ))}
      </div>

      {/* Active scenario info bar */}
      {selectedScenario &&
        (() => {
          const s = scenarios.find((x) => x.id === selectedScenario);
          return (
            <div className="flex flex-wrap gap-4 mb-6 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm">
              <span className="text-white/50">
                Environment:{" "}
                <span className="text-white font-medium">{s.environment}</span>
              </span>
              <span className="text-white/30">|</span>
              <span className="text-white/50">
                Concepts:{" "}
                <span className="text-amber-300 font-medium">
                  {s.concepts.join(" · ")}
                </span>
              </span>
              <span className="text-white/30">|</span>
              <span className="text-white/50">
                AR:{" "}
                <span className="text-amber-300 font-medium">
                  Tap "Enter AR Mode" on the shelf →
                </span>
              </span>
            </div>
          );
        })()}

      {/* 3D / AR Viewer */}
      {selectedScenario === "grocery" && <GroceryShelf />}
    </div>
  );
}

export default ArrayPage;
