import React, { useState } from "react";
import { Link } from "react-router-dom";
import BookStack from "../components/BookStack";
import StorageBoxes from "../components/StorageBoxes";

const scenarios = [
  {
    id: "books",
    name: "Book Stack",
    environment: "Table Surface",
    icon: "📚",
    description: "Realistic vertical stacking of virtual books",
    concepts: ["LIFO (Last-In, First-Out) principle", "Vertical growth"],
    status: "ready",
  },
  {
    id: "plates",
    name: "Plate Stack",
    environment: "Desk/Table",
    icon: "🍽️",
    description: "Cafeteria-style plates stacking on top of each other",
    concepts: ["Push/Pop mechanics", "Handling Underflow (empty)"],
    status: "coming",
  },
  {
    id: "boxes",
    name: "Storage Boxes",
    environment: "Bookshelf",
    icon: "📦",
    description: "Boxes sliding in and out of a shelf stack",
    concepts: ["Top-of-stack tracking", "Peek operation visibility"],
    status: "ready",
  },
];

function StackPage() {
  const [selectedScenario, setSelectedScenario] = useState("books");

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
        <h1 className="text-4xl md:text-5xl mb-3 font-bold">📚 Stack</h1>
        <p className="text-lg opacity-80 max-w-2xl leading-relaxed">
          A LIFO (Last-In, First-Out) structure — only the TOP element is
          accessible. Like a stack of books: you can only add or remove from the
          top.
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
                    ? "border-orange-400 bg-orange-400/20 text-orange-300 shadow-[0_0_16px_rgba(251,146,60,0.25)]"
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
                <span className="text-orange-300 font-medium">
                  {s.concepts.join(" · ")}
                </span>
              </span>
            </div>
          );
        })()}

      {/* 3D Viewer */}
      {selectedScenario === "books" && <BookStack />}
      {selectedScenario === "boxes" && <StorageBoxes />}
    </div>
  );
}

export default StackPage;
