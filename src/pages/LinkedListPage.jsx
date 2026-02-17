import React, { useState } from "react";
import { Link } from "react-router-dom";
import DominoNodes from "../components/Dominonodes";

const scenarios = [
  {
    id: "train",
    name: "Train Cars",
    environment: "Hallway",
    icon: "🚃",
    description: "Cars connected via virtual couplers (pointers)",
    concepts: ["Node-pointer relationships", "Non-contiguous visual logic"],
    status: "coming",
  },
  {
    id: "people",
    name: "People in Line",
    environment: "Open Floor",
    icon: "👥",
    description: "Human avatars with directional arrows between them",
    concepts: ["Dynamic memory (inserting anywhere)", "Pointer redirection"],
    status: "coming",
  },
  {
    id: "domino",
    name: "Domino Nodes",
    environment: "Long Table",
    icon: "🁢",
    description: "Sequence of tiles that light up one by one",
    concepts: ["Sequential traversal", "Head/tail pointers", "Reversing links"],
    status: "ready",
  },
];

function LinkedListPage() {
  const [selectedScenario, setSelectedScenario] = useState("domino");

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-block px-5 py-2 bg-white/10 border-2 border-white/30 rounded-lg text-white no-underline mb-6 transition-all font-medium hover:bg-white/20 hover:border-white/50 hover:-translate-x-1 text-sm"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl md:text-5xl mb-3 font-bold">🚂 Linked List</h1>
        <p className="text-lg opacity-80 max-w-2xl leading-relaxed">
          A chain of nodes — each storing data and a pointer to the next. No
          contiguous memory needed, just follow the links.
        </p>
      </div>

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
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.25)]"
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
                <span className="text-cyan-300 font-medium">
                  {s.concepts.join(" · ")}
                </span>
              </span>
            </div>
          );
        })()}

      {/* 3D Viewer */}
      {selectedScenario === "domino" && <DominoNodes />}
    </div>
  );
}

export default LinkedListPage;
