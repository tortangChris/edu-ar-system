import React, { useState } from "react";
import { Link } from "react-router-dom";
import CarTollGate from "../components/CarTollgate";
import TicketQueue from "../components/Ticketqueue";

const scenarios = [
  {
    id: "attendance",
    name: "Student Attendance",
    environment: "Hallway",
    icon: "👨‍🎓",
    description: "Avatars lining up for a specific point",
    concepts: ["FIFO (First-In, First-Out) principle", "Front/Rear pointers"],
    status: "coming",
  },
  {
    id: "tickets",
    name: "Ticket Queue",
    environment: "Desk Surface",
    icon: "🎫",
    description: "Virtual cards moving through a processing line",
    concepts: ["Enqueue/Dequeue flow", "Pointer movement visualization"],
    status: "ready",
  },
  {
    id: "tollgate",
    name: "Car Toll Gate",
    environment: "Floor Area",
    icon: "🚗",
    description: "Cars joining the rear and exiting from the front",
    concepts: ["Real-time flow", "Handling line length and front access"],
    status: "ready",
  },
];

function QueuePage() {
  const [selectedScenario, setSelectedScenario] = useState("tickets");

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
        <h1 className="text-4xl md:text-5xl mb-3 font-bold">🚶 Queue</h1>
        <p className="text-lg opacity-80 max-w-2xl leading-relaxed">
          A FIFO (First-In, First-Out) structure — elements join the REAR and
          exit from the FRONT. Just like a real queue at a service window.
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
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
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
                <span className="text-yellow-300 font-medium">
                  {s.concepts.join(" · ")}
                </span>
              </span>
            </div>
          );
        })()}

      {/* 3D Viewer */}
      {selectedScenario === "tickets" && <TicketQueue />}
      {selectedScenario === "tollgate" && <CarTollGate />}
    </div>
  );
}

export default QueuePage;
