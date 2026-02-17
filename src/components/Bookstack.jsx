import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Text,
  RoundedBox,
  OrbitControls,
  Environment,
} from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";

// ─── Constants ─────────────────────────────────────────────────────────────────
const BOOK_H = 0.22;
const BOOK_W = 1.1;
const BOOK_D = 0.72;
const STACK_X = 0;
const STACK_BASE = -0.6;

const BOOK_STYLES = [
  {
    spine: "#c0392b",
    cover: "#922b21",
    title: "DATA\nSTRUCTURES",
    text: "#fff",
  },
  { spine: "#2471a3", cover: "#1a5276", title: "ALGORITHMS", text: "#fff" },
  { spine: "#1e8449", cover: "#145a32", title: "COMP\nSCIENCE", text: "#fff" },
  {
    spine: "#d4ac0d",
    cover: "#9a7d0a",
    title: "DISCRETE\nMATH",
    text: "#1a1a1a",
  },
  { spine: "#7d3c98", cover: "#6c3483", title: "GRAPH\nTHEORY", text: "#fff" },
  {
    spine: "#ca6f1e",
    cover: "#935116",
    title: "SORTING\n&\nSEARCH",
    text: "#fff",
  },
  {
    spine: "#148f77",
    cover: "#0e6655",
    title: "BIG-O\nNOTATION",
    text: "#fff",
  },
  { spine: "#922b21", cover: "#6e2017", title: "RECURSION", text: "#fff" },
];

// ─── Single Book ───────────────────────────────────────────────────────────────
function Book({
  index,
  stackIndex,
  style,
  isPeeked,
  isTop,
  isAnimating,
  onHover,
}) {
  const groupRef = useRef();
  const y = STACK_BASE + stackIndex * BOOK_H + BOOK_H / 2;

  useEffect(() => {
    if (!groupRef.current) return;
    gsap.fromTo(
      groupRef.current.position,
      { y: y + 6, x: 2.5 },
      { y, x: STACK_X, duration: 0.55, ease: "back.out(1.4)", delay: 0.05 },
    );
  }, []);

  useEffect(() => {
    if (!groupRef.current) return;
    gsap.to(groupRef.current.position, {
      y,
      duration: 0.45,
      ease: "power3.out",
    });
  }, [stackIndex]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Slight float for top (peek) book
    if (isPeeked && isTop) {
      groupRef.current.position.y = y + Math.sin(Date.now() * 0.002) * 0.025;
    }
  });

  return (
    <group ref={groupRef} position={[STACK_X, y, 0]}>
      {/* Book body */}
      <RoundedBox
        args={[BOOK_W, BOOK_H - 0.02, BOOK_D]}
        radius={0.018}
        smoothness={4}
        onPointerOver={() => onHover(index)}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial
          color={style.cover}
          roughness={0.55}
          metalness={0.05}
        />
      </RoundedBox>

      {/* Spine (left side) */}
      <mesh position={[-(BOOK_W / 2) + 0.01, 0, 0]}>
        <boxGeometry args={[0.04, BOOK_H - 0.025, BOOK_D]} />
        <meshStandardMaterial color={style.spine} roughness={0.4} />
      </mesh>

      {/* Top face (visible when looking down) */}
      <mesh position={[0, BOOK_H / 2 - 0.005, 0]}>
        <boxGeometry args={[BOOK_W - 0.02, 0.008, BOOK_D - 0.02]} />
        <meshStandardMaterial color="#e8e8e0" roughness={0.8} />
      </mesh>

      {/* Page edges (right side) */}
      <mesh position={[BOOK_W / 2 - 0.025, 0, 0]}>
        <boxGeometry args={[0.045, BOOK_H - 0.03, BOOK_D - 0.04]} />
        <meshStandardMaterial color="#f2ede0" roughness={0.9} />
      </mesh>

      {/* Title on cover */}
      <Text
        position={[0.05, 0, BOOK_D / 2 + 0.002]}
        fontSize={0.085}
        color={style.text}
        anchorX="center"
        anchorY="middle"
        maxWidth={0.85}
        textAlign="center"
        lineHeight={1.2}
      >
        {style.title}
      </Text>

      {/* Stack index label on spine */}
      <Text
        position={[-(BOOK_W / 2) + 0.035, 0, 0]}
        fontSize={0.07}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        [{stackIndex}]
      </Text>

      {/* TOP indicator */}
      {isTop && (
        <>
          <mesh
            position={[0, BOOK_H / 2 + 0.04, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.42, 0.48, 48]} />
            <meshStandardMaterial
              color="#f39c12"
              emissive="#f39c12"
              emissiveIntensity={isPeeked ? 2 : 1}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Text
            position={[0.62, BOOK_H / 2 + 0.06, 0]}
            fontSize={0.1}
            color={isPeeked ? "#f39c12" : "#e0e0ff"}
            anchorX="left"
            anchorY="middle"
          >
            ← TOP
          </Text>
        </>
      )}
    </group>
  );
}

// ─── Floating "push" book coming from above ────────────────────────────────────
function PushAnimation({ style, targetY, onDone }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.position,
      { y: targetY + 5, x: -2.8, z: 0 },
      {
        y: targetY,
        x: STACK_X,
        z: 0,
        duration: 0.6,
        ease: "back.out(1.2)",
        onComplete: onDone,
      },
    );
  }, []);

  return (
    <group ref={ref} position={[-2.8, targetY + 5, 0]}>
      <RoundedBox
        args={[BOOK_W, BOOK_H - 0.02, BOOK_D]}
        radius={0.018}
        smoothness={4}
      >
        <meshStandardMaterial
          color={style.cover}
          roughness={0.55}
          emissive={style.cover}
          emissiveIntensity={0.3}
        />
      </RoundedBox>
      <mesh position={[-(BOOK_W / 2) + 0.01, 0, 0]}>
        <boxGeometry args={[0.04, BOOK_H - 0.025, BOOK_D]} />
        <meshStandardMaterial color={style.spine} />
      </mesh>
    </group>
  );
}

// ─── Floating "pop" book leaving upward ───────────────────────────────────────
function PopAnimation({ style, fromY, onDone }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.position,
      { y: fromY, x: STACK_X },
      {
        y: fromY + 5,
        x: 2.8,
        duration: 0.55,
        ease: "back.in(1.2)",
        onComplete: onDone,
      },
    );
    gsap.to(ref.current, {
      opacity: 0,
      duration: 0.4,
      delay: 0.2,
    });
  }, []);

  return (
    <group ref={ref} position={[STACK_X, fromY, 0]}>
      <RoundedBox
        args={[BOOK_W, BOOK_H - 0.02, BOOK_D]}
        radius={0.018}
        smoothness={4}
      >
        <meshStandardMaterial
          color={style.cover}
          roughness={0.55}
          emissive="#ffffff"
          emissiveIntensity={0.4}
          transparent
          opacity={1}
        />
      </RoundedBox>
      <mesh position={[-(BOOK_W / 2) + 0.01, 0, 0]}>
        <boxGeometry args={[0.04, BOOK_H - 0.025, BOOK_D]} />
        <meshStandardMaterial color={style.spine} />
      </mesh>
    </group>
  );
}

// ─── Table / shelf base ────────────────────────────────────────────────────────
function TableBase() {
  return (
    <group position={[0, STACK_BASE - 0.07, 0]}>
      {/* Surface */}
      <mesh receiveShadow>
        <boxGeometry args={[2.8, 0.1, 1.4]} />
        <meshStandardMaterial
          color="#2c1a0e"
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>
      {/* Grain lines */}
      {[-0.4, 0, 0.4].map((z, i) => (
        <mesh key={i} position={[0, 0.052, z]}>
          <boxGeometry args={[2.8, 0.003, 0.06]} />
          <meshStandardMaterial color="#3d2412" roughness={0.9} />
        </mesh>
      ))}
      {/* Legs */}
      {[
        [-1.15, -0.55, -0.5],
        [-1.15, -0.55, 0.5],
        [1.15, -0.55, -0.5],
        [1.15, -0.55, 0.5],
      ].map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.1, 1.0, 0.1]} />
          <meshStandardMaterial color="#1e0f06" roughness={0.85} />
        </mesh>
      ))}
      {/* Empty stack indicator */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[BOOK_W + 0.05, 0.005, BOOK_D + 0.05]} />
        <meshStandardMaterial
          color="#5a3e28"
          roughness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

// ─── Full 3D Scene ─────────────────────────────────────────────────────────────
function StackScene({
  stack,
  isPeeked,
  pushAnim,
  popAnim,
  onPushDone,
  onPopDone,
  hoveredIndex,
  onHover,
}) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 4]} intensity={1.1} castShadow />
      <directionalLight
        position={[-3, 5, -2]}
        intensity={0.35}
        color="#c0b0e0"
      />
      <pointLight position={[1.5, 3, 1.5]} intensity={0.5} color="#ffe8c0" />
      <pointLight position={[-1.5, 2, 0]} intensity={0.3} color="#a0c0ff" />

      <TableBase />

      {/* Stacked books */}
      {stack.map((book, i) => (
        <Book
          key={book.id}
          index={i}
          stackIndex={i}
          style={BOOK_STYLES[book.styleIdx]}
          isPeeked={isPeeked}
          isTop={i === stack.length - 1}
          onHover={onHover}
        />
      ))}

      {/* Push animation overlay */}
      {pushAnim && (
        <PushAnimation
          style={BOOK_STYLES[pushAnim.styleIdx]}
          targetY={STACK_BASE + stack.length * BOOK_H + BOOK_H / 2 - BOOK_H}
          onDone={onPushDone}
        />
      )}

      {/* Pop animation overlay */}
      {popAnim && (
        <PopAnimation
          style={BOOK_STYLES[popAnim.styleIdx]}
          fromY={STACK_BASE + stack.length * BOOK_H + BOOK_H / 2}
          onDone={onPopDone}
        />
      )}

      {/* Empty stack text */}
      {stack.length === 0 && !pushAnim && (
        <Text
          position={[0, STACK_BASE + 0.18, 0]}
          fontSize={0.16}
          color="#5a5a8a"
          anchorX="center"
          anchorY="middle"
        >
          Stack is Empty
        </Text>
      )}

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3.5}
        maxDistance={12}
        target={[0, 0.4, 0]}
      />
      <Environment preset="apartment" />
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
const INITIAL_STACK = [
  { id: 1, styleIdx: 0 },
  { id: 2, styleIdx: 1 },
  { id: 3, styleIdx: 2 },
];
let nextId = 10;

export default function BookStack() {
  const [stack, setStack] = useState(INITIAL_STACK);
  const [isPeeked, setIsPeeked] = useState(false);
  const [pushAnim, setPushAnim] = useState(null);
  const [popAnim, setPopAnim] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [log, setLog] = useState([]);
  const [pushStyleIdx, setPushStyleIdx] = useState(3);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("push");
  const MAX_STACK = 8;

  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, id: Date.now() }, ...prev].slice(0, 8));

  // ── Push ──────────────────────────────────────────────────────────────────
  const handlePush = () => {
    if (isAnimating) return;
    if (stack.length >= MAX_STACK)
      return addLog(`⚠️ Stack Overflow! Max ${MAX_STACK} books.`, "error");
    setIsAnimating(true);
    setIsPeeked(false);
    const newBook = { id: nextId++, styleIdx: pushStyleIdx };
    setPushAnim(newBook);
    addLog(
      `📗 Push "${BOOK_STYLES[pushStyleIdx].title.replace("\n", " ")}" → new TOP at [${stack.length}]  ·  O(1)`,
      "success",
    );
  };

  const handlePushDone = () => {
    const newBook = { id: pushAnim.id, styleIdx: pushAnim.styleIdx };
    setStack((prev) => [...prev, newBook]);
    setPushAnim(null);
    setIsAnimating(false);
  };

  // ── Pop ───────────────────────────────────────────────────────────────────
  const handlePop = () => {
    if (isAnimating) return;
    if (stack.length === 0)
      return addLog("⚠️ Stack Underflow! Stack is empty.", "error");
    setIsAnimating(true);
    setIsPeeked(false);
    const top = stack[stack.length - 1];
    setPopAnim(top);
    setStack((prev) => prev.slice(0, -1));
    addLog(
      `📕 Pop "${BOOK_STYLES[top.styleIdx].title.replace("\n", " ")}" from TOP [${stack.length - 1}]  ·  O(1)`,
      "success",
    );
  };

  const handlePopDone = () => {
    setPopAnim(null);
    setIsAnimating(false);
  };

  // ── Peek ──────────────────────────────────────────────────────────────────
  const handlePeek = () => {
    if (stack.length === 0)
      return addLog("⚠️ Stack is empty — nothing to peek!", "error");
    const top = stack[stack.length - 1];
    setIsPeeked((p) => !p);
    addLog(
      `👁️ Peek → TOP is "${BOOK_STYLES[top.styleIdx].title.replace("\n", " ")}" at [${stack.length - 1}]  ·  O(1)`,
      "success",
    );
  };

  // ── Clear ──────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (isAnimating) return;
    setStack([]);
    setIsPeeked(false);
    addLog("🗑️ Stack cleared — all books removed", "info");
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (isAnimating) return;
    setStack(INITIAL_STACK);
    setIsPeeked(false);
    setLog([]);
  };

  const tabBtn = (tab, emoji, label) => (
    <button
      key={tab}
      onClick={() => {
        setActiveTab(tab);
        setIsPeeked(false);
      }}
      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
        activeTab === tab
          ? "bg-orange-400 border-orange-400 text-gray-900"
          : "bg-transparent border-white/20 text-white/60 hover:border-orange-400/50 hover:text-white"
      }`}
    >
      {emoji} {label}
    </button>
  );

  const topBook = stack.length > 0 ? stack[stack.length - 1] : null;

  return (
    <div
      className="flex flex-col gap-4 w-full"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-orange-300 tracking-widest">
          📚 BOOK STACK
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Stack size:{" "}
          <span className="text-orange-300 font-bold">{stack.length}</span> /{" "}
          {MAX_STACK}
          &nbsp;·&nbsp;
          {stack.length === 0 ? (
            <span className="text-red-400">Empty</span>
          ) : (
            <>
              TOP:{" "}
              <span className="text-orange-300 font-bold">
                [{stack.length - 1}] "
                {BOOK_STYLES[topBook.styleIdx].title.replace(/\n/g, " ")}"
              </span>
            </>
          )}
        </p>
      </div>

      {/* 3D Canvas */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-orange-400/30 shadow-[0_0_40px_rgba(251,146,60,0.12)]"
        style={{
          height: 460,
          background:
            "linear-gradient(180deg,#100a05 0%,#1c1008 50%,#0d0704 100%)",
        }}
      >
        <Canvas camera={{ position: [2.2, 2.5, 6.5], fov: 44 }} shadows>
          <StackScene
            stack={stack}
            isPeeked={isPeeked}
            pushAnim={pushAnim}
            popAnim={popAnim}
            onPushDone={handlePushDone}
            onPopDone={handlePopDone}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
          />
        </Canvas>
      </div>

      {/* Stack visualizer bar */}
      <div className="flex gap-1 flex-wrap justify-center items-end">
        <span className="text-white/30 text-xs mr-1">BOTTOM</span>
        {stack.length === 0 ? (
          <span className="text-white/20 text-xs italic px-3 py-1 border border-white/10 rounded-lg">
            [ empty ]
          </span>
        ) : (
          stack.map((book, i) => (
            <div
              key={book.id}
              className={`flex flex-col items-center px-2 py-1 rounded-lg border text-xs transition-all ${
                i === stack.length - 1
                  ? "border-orange-400 bg-orange-400/20 text-orange-300 scale-110"
                  : "border-white/20 bg-white/10 text-white/70"
              }`}
              style={{ borderLeftColor: BOOK_STYLES[book.styleIdx].spine }}
            >
              <span className="text-base">📗</span>
              <span className="font-mono font-bold">[{i}]</span>
              {i === stack.length - 1 && (
                <span className="text-[9px] text-orange-400 font-bold">
                  TOP
                </span>
              )}
            </div>
          ))
        )}
        <span className="text-white/30 text-xs ml-1">TOP →</span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Operations panel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabBtn("push", "📗", "Push")}
            {tabBtn("pop", "📕", "Pop")}
            {tabBtn("peek", "👁️", "Peek")}
            {tabBtn("clear", "🗑️", "Clear")}
          </div>

          {/* Push */}
          {activeTab === "push" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Add a book to the TOP of the stack —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-white/60 text-sm">Book:</span>
                <select
                  value={pushStyleIdx}
                  onChange={(e) => setPushStyleIdx(Number(e.target.value))}
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400"
                >
                  {BOOK_STYLES.map((s, i) => (
                    <option key={i} value={i}>
                      📗 {s.title.replace("\n", " ")}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handlePush}
                  disabled={isAnimating || stack.length >= MAX_STACK}
                  className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  Push ↑
                </button>
              </div>
              <p className="text-white/30 text-xs">
                {stack.length >= MAX_STACK
                  ? "⚠️ Stack is full!"
                  : `${MAX_STACK - stack.length} slots remaining`}
              </p>
            </div>
          )}

          {/* Pop */}
          {activeTab === "pop" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Remove the TOP book —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
                &nbsp;· LIFO: last pushed is first popped
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handlePop}
                  disabled={isAnimating || stack.length === 0}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  Pop ↓
                </button>
                {stack.length === 0 && (
                  <span className="text-red-400 text-xs">Stack Underflow!</span>
                )}
                {topBook && (
                  <span className="text-white/50 text-xs">
                    Will remove:{" "}
                    <span className="text-orange-300">
                      "{BOOK_STYLES[topBook.styleIdx].title.replace("\n", " ")}"
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Peek */}
          {activeTab === "peek" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                View TOP without removing —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handlePeek}
                  disabled={stack.length === 0}
                  className={`px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all ${
                    isPeeked
                      ? "bg-orange-500 hover:bg-orange-400"
                      : "bg-yellow-600 hover:bg-yellow-500"
                  }`}
                >
                  {isPeeked ? "👁️ Hide Peek" : "👁️ Peek TOP"}
                </button>
                {isPeeked && topBook && (
                  <div className="px-3 py-1.5 bg-orange-400/15 border border-orange-400/40 rounded-lg text-orange-300 text-xs font-bold">
                    TOP [{stack.length - 1}] = "
                    {BOOK_STYLES[topBook.styleIdx].title.replace("\n", " ")}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clear */}
          {activeTab === "clear" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Remove all books —{" "}
                <span className="text-red-400 font-bold">O(n)</span>
                &nbsp;· repeated pop until empty
              </p>
              <button
                onClick={handleClear}
                disabled={isAnimating || stack.length === 0}
                className="px-5 py-2.5 bg-red-800 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all w-fit"
              >
                🗑️ Clear All Books
              </button>
            </div>
          )}

          <button
            onClick={handleReset}
            disabled={isAnimating}
            className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-sm transition-all disabled:opacity-40"
          >
            🔄 Reset to Default
          </button>
        </div>

        {/* Log + Complexity */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
              📋 Operation Log
            </p>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
              {log.length === 0 ? (
                <p className="text-white/30 text-xs italic">
                  No operations yet...
                </p>
              ) : (
                log.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`text-xs font-mono py-1 px-2 rounded border-l-2 ${
                      entry.type === "success"
                        ? "border-green-400 bg-green-400/5 text-green-300"
                        : entry.type === "error"
                          ? "border-red-400 bg-red-400/5 text-red-300"
                          : "border-blue-400 bg-blue-400/5 text-blue-300"
                    } ${i > 0 ? "opacity-50" : ""}`}
                  >
                    {entry.msg}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
              ⚡ Time Complexity
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs font-mono">
              {[
                ["Push", "O(1)", true],
                ["Pop", "O(1)", true],
                ["Peek", "O(1)", true],
                ["isEmpty", "O(1)", true],
                ["Clear", "O(n)", false],
                ["Search", "O(n)", false],
              ].map(([op, c, fast]) => (
                <div
                  key={op}
                  className="flex justify-between px-3 py-1.5 bg-white/5 rounded-lg"
                >
                  <span className="text-white/55">{op}</span>
                  <span
                    className={`font-bold ${fast ? "text-green-400" : "text-red-400"}`}
                  >
                    {c}
                  </span>
                </div>
              ))}
            </div>

            {/* LIFO reminder */}
            <div className="mt-3 px-3 py-2 bg-orange-400/10 border border-orange-400/30 rounded-lg">
              <p className="text-orange-300 text-xs font-bold">
                LIFO Principle
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                Last In → First Out. The last book pushed is always the first to
                be popped.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-white/25 text-xs pb-2">
        💡 Drag to rotate · Scroll to zoom · Push & Pop to see LIFO in action
      </p>
    </div>
  );
}
