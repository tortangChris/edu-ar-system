import React, { useState } from "react";
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

function ArrayPage() {
  const [selectedScenario, setSelectedScenario] = useState("grocery");

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
        <h1 className="text-4xl md:text-5xl mb-3 font-bold">📦 Array</h1>
        <p className="text-lg opacity-80 max-w-2xl leading-relaxed">
          A collection of elements stored in contiguous memory. Each element has
          a fixed index — explore operations below.
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
            </div>
          );
        })()}

      {/* 3D Viewer */}
      {selectedScenario === "grocery" && <GroceryShelf />}
    </div>
  );
}

export default ArrayPage;
