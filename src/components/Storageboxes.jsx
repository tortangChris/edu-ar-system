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
const SLOT_W = 1.05;
const SLOT_H = 0.72;
const SLOT_D = 1.5;
const BOX_W = 0.88;
const BOX_H = 0.58;
const BOX_D = 1.22;
const MAX_SLOTS = 6;
const SHELF_X = 0;
const SHELF_BASE_Y = -1.1;

const BOX_STYLES = [
  { body: "#c0392b", stripe: "#922b21", label: "FRAGILE", icon: "⚠️" },
  { body: "#2471a3", stripe: "#1a5276", label: "BOOKS", icon: "📚" },
  { body: "#1e8449", stripe: "#145a32", label: "TOOLS", icon: "🔧" },
  { body: "#d4ac0d", stripe: "#9a7d0a", label: "CLOTHES", icon: "👕" },
  { body: "#7d3c98", stripe: "#6c3483", label: "TOYS", icon: "🧸" },
  { body: "#ca6f1e", stripe: "#935116", label: "KITCHEN", icon: "🍳" },
  { body: "#148f77", stripe: "#0e6655", label: "SPORTS", icon: "⚽" },
  { body: "#884ea0", stripe: "#76448a", label: "OFFICE", icon: "📁" },
];

// ─── Single storage box ────────────────────────────────────────────────────────
function StorageBox({
  slotIndex,
  style,
  isTop,
  isPeeked,
  isSlidingIn,
  isSlidingOut,
  onDone,
}) {
  const groupRef = useRef();
  const y = SHELF_BASE_Y + slotIndex * SLOT_H + SLOT_H / 2 + 0.06;

  // Slide IN from the right
  useEffect(() => {
    if (!groupRef.current) return;
    if (isSlidingIn) {
      groupRef.current.position.set(SHELF_X + 3.5, y, 0);
      gsap.to(groupRef.current.position, {
        x: SHELF_X,
        duration: 0.55,
        ease: "power3.out",
        onComplete: onDone,
      });
    } else {
      groupRef.current.position.set(SHELF_X, y, 0);
      gsap.fromTo(
        groupRef.current.position,
        { x: SHELF_X + 4, y: y + 0.5 },
        {
          x: SHELF_X,
          y,
          duration: 0.5,
          ease: "back.out(1.3)",
          delay: slotIndex * 0.08,
        },
      );
    }
  }, []);

  // Slide OUT to the right
  useEffect(() => {
    if (isSlidingOut && groupRef.current) {
      gsap.to(groupRef.current.position, {
        x: SHELF_X + 3.8,
        duration: 0.48,
        ease: "power3.in",
        onComplete: onDone,
      });
      gsap.to(groupRef.current.scale, {
        x: 0.95,
        y: 0.95,
        z: 0.95,
        duration: 0.48,
        ease: "power3.in",
      });
    }
  }, [isSlidingOut]);

  // Gentle float for TOP/peeked box
  useFrame((state) => {
    if (!groupRef.current || isSlidingIn || isSlidingOut) return;
    if (isTop && isPeeked) {
      groupRef.current.position.x =
        SHELF_X + Math.sin(state.clock.elapsedTime * 1.5) * 0.06;
    } else {
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        SHELF_X,
        0.1,
      );
    }
  });

  const emissiveInt = isPeeked && isTop ? 0.35 : 0;

  return (
    <group ref={groupRef} position={[SHELF_X, y, 0]}>
      {/* Main box body */}
      <RoundedBox args={[BOX_W, BOX_H, BOX_D]} radius={0.04} smoothness={4}>
        <meshStandardMaterial
          color={style.body}
          roughness={0.45}
          metalness={0.08}
          emissive={style.body}
          emissiveIntensity={emissiveInt}
        />
      </RoundedBox>

      {/* Lid top */}
      <mesh position={[0, BOX_H / 2 + 0.018, 0]}>
        <boxGeometry args={[BOX_W + 0.04, 0.032, BOX_D + 0.04]} />
        <meshStandardMaterial
          color={style.stripe}
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>

      {/* Warning stripe tape across the front */}
      <mesh position={[0, 0, BOX_D / 2 + 0.002]}>
        <planeGeometry args={[BOX_W - 0.04, 0.085]} />
        <meshStandardMaterial color={style.stripe} roughness={0.5} />
      </mesh>

      {/* Label sticker */}
      <mesh position={[0, 0.08, BOX_D / 2 + 0.003]}>
        <planeGeometry args={[0.52, 0.26]} />
        <meshStandardMaterial color="#f5f0e0" roughness={0.8} />
      </mesh>
      <Text
        position={[0, 0.08, BOX_D / 2 + 0.008]}
        fontSize={0.085}
        color="#1a1a1a"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.48}
        textAlign="center"
      >
        {style.label}
      </Text>

      {/* Handle cutout on front */}
      <mesh position={[0, -0.15, BOX_D / 2 + 0.002]}>
        <planeGeometry args={[0.26, 0.07]} />
        <meshStandardMaterial color={style.stripe} roughness={0.6} />
      </mesh>

      {/* Corner reinforcements */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[sx * (BOX_W / 2 - 0.04), 0, sz * (BOX_D / 2 - 0.04)]}
        >
          <boxGeometry args={[0.045, BOX_H + 0.01, 0.045]} />
          <meshStandardMaterial
            color={style.stripe}
            roughness={0.4}
            metalness={0.15}
          />
        </mesh>
      ))}

      {/* Slot index tag on spine */}
      <group position={[BOX_W / 2 + 0.01, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 0.22, 0.38]} />
          <meshStandardMaterial
            color={isTop ? "#f39c12" : "#1a1a2e"}
            roughness={0.5}
          />
        </mesh>
        <Text
          position={[0.015, 0, 0]}
          fontSize={0.09}
          color={isTop ? "#1a1a1a" : "#7ec8e3"}
          anchorX="center"
          anchorY="middle"
          rotation={[0, Math.PI / 2, 0]}
        >
          [{slotIndex}]
        </Text>
      </group>

      {/* TOP glow arrow on right side */}
      {isTop && (
        <>
          <mesh
            position={[BOX_W / 2 + 0.32, 0, 0]}
            rotation={[0, 0, -Math.PI / 2]}
          >
            <coneGeometry args={[0.075, 0.18, 8]} />
            <meshStandardMaterial
              color="#f39c12"
              emissive="#f39c12"
              emissiveIntensity={isPeeked ? 2.5 : 1.2}
            />
          </mesh>
          <Text
            position={[BOX_W / 2 + 0.56, 0, 0]}
            fontSize={0.095}
            color={isPeeked ? "#f39c12" : "#e0d0a0"}
            anchorX="left"
            anchorY="middle"
          >
            TOP
          </Text>
        </>
      )}
    </group>
  );
}

// ─── Bookshelf / Rack structure ────────────────────────────────────────────────
function Bookshelf({ slotCount }) {
  const totalH = slotCount * SLOT_H + 0.15;
  const shelfY = (i) => SHELF_BASE_Y + i * SLOT_H;

  return (
    <group>
      {/* Left vertical panel */}
      <mesh position={[-(SLOT_W / 2 + 0.06), SHELF_BASE_Y + totalH / 2, 0]}>
        <boxGeometry args={[0.1, totalH + 0.12, SLOT_D + 0.12]} />
        <meshStandardMaterial
          color="#2c1a0e"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      {/* Right vertical panel */}
      <mesh position={[SLOT_W / 2 + 0.06, SHELF_BASE_Y + totalH / 2, 0]}>
        <boxGeometry args={[0.1, totalH + 0.12, SLOT_D + 0.12]} />
        <meshStandardMaterial
          color="#2c1a0e"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      {/* Back panel */}
      <mesh position={[0, SHELF_BASE_Y + totalH / 2, -(SLOT_D / 2 + 0.04)]}>
        <boxGeometry args={[SLOT_W + 0.24, totalH + 0.12, 0.06]} />
        <meshStandardMaterial color="#1e0f06" roughness={0.9} />
      </mesh>

      {/* Horizontal shelf dividers */}
      {Array.from({ length: slotCount + 1 }).map((_, i) => (
        <mesh key={i} position={[0, shelfY(i) - 0.005, 0]}>
          <boxGeometry args={[SLOT_W + 0.12, 0.055, SLOT_D + 0.08]} />
          <meshStandardMaterial
            color="#3d2412"
            roughness={0.75}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Slot depth indicators (empty slots) */}
      {Array.from({ length: slotCount }).map((_, i) => (
        <mesh
          key={`slot-${i}`}
          position={[0, shelfY(i) + SLOT_H / 2, -(SLOT_D / 2 - 0.04)]}
        >
          <boxGeometry args={[SLOT_W - 0.06, SLOT_H - 0.08, 0.02]} />
          <meshStandardMaterial
            color="#120a04"
            roughness={0.9}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {/* Floor base */}
      <mesh position={[0, SHELF_BASE_Y - 0.085, 0]}>
        <boxGeometry args={[SLOT_W + 0.6, 0.1, SLOT_D + 0.4]} />
        <meshStandardMaterial color="#1a0d06" roughness={0.9} />
      </mesh>

      {/* Metal rail on right side */}
      <mesh position={[SLOT_W / 2 + 0.14, SHELF_BASE_Y + totalH / 2, 0]}>
        <boxGeometry args={[0.025, totalH, 0.025]} />
        <meshStandardMaterial color="#8a8a8a" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Full 3D Scene ─────────────────────────────────────────────────────────────
function ShelfScene({
  stack,
  isPeeked,
  slidingInIdx,
  slidingOutIdx,
  onSlideInDone,
  onSlideOutDone,
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 3]} intensity={1.0} castShadow />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.3}
        color="#c0b8e0"
      />
      <pointLight position={[2, 1, 2]} intensity={0.6} color="#ffe8c0" />
      <pointLight position={[-1, 3, 1]} intensity={0.25} color="#a8d0ff" />

      <Bookshelf slotCount={MAX_SLOTS} />

      {/* Render each box in the stack */}
      {stack.map((box, i) => {
        const isSlideIn = i === stack.length - 1 && slidingInIdx === box.id;
        const isSlideOut = slidingOutIdx === box.id;
        return (
          <StorageBox
            key={box.id}
            slotIndex={i}
            style={BOX_STYLES[box.styleIdx]}
            isTop={i === stack.length - 1}
            isPeeked={isPeeked && i === stack.length - 1}
            isSlidingIn={isSlideIn}
            isSlidingOut={isSlideOut}
            onDone={
              isSlideIn
                ? onSlideInDone
                : isSlideOut
                  ? onSlideOutDone
                  : undefined
            }
          />
        );
      })}

      {/* Empty state label */}
      {stack.length === 0 && (
        <Text
          position={[0, SHELF_BASE_Y + SLOT_H * 1.5, 0]}
          fontSize={0.14}
          color="#4a4a6a"
          anchorX="center"
          anchorY="middle"
        >
          Stack Empty
        </Text>
      )}

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3.5}
        maxDistance={11}
        target={[0, -0.1, 0]}
      />
      <Environment preset="warehouse" />
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
const INITIAL_STACK = [
  { id: 1, styleIdx: 0 },
  { id: 2, styleIdx: 1 },
  { id: 3, styleIdx: 2 },
];
let nextId = 20;

export default function StorageBoxes() {
  const [stack, setStack] = useState(INITIAL_STACK);
  const [isPeeked, setIsPeeked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slidingInIdx, setSlidingIn] = useState(null);
  const [slidingOutIdx, setSlidingOut] = useState(null);
  const [activeTab, setActiveTab] = useState("push");
  const [pushStyleIdx, setPushStyleIdx] = useState(3);
  const [log, setLog] = useState([]);
  const [pendingPop, setPendingPop] = useState(null);

  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, id: Date.now() }, ...prev].slice(0, 8));

  const topBox = stack.length > 0 ? stack[stack.length - 1] : null;

  // ── Push ───────────────────────────────────────────────────────────────────
  const handlePush = () => {
    if (isAnimating) return;
    if (stack.length >= MAX_SLOTS)
      return addLog(
        `⚠️ Stack Overflow! Shelf is full (max ${MAX_SLOTS}).`,
        "error",
      );
    setIsAnimating(true);
    setIsPeeked(false);
    const newBox = { id: nextId++, styleIdx: pushStyleIdx };
    setStack((prev) => [...prev, newBox]);
    setSlidingIn(newBox.id);
    addLog(
      `📦 Push "${BOX_STYLES[pushStyleIdx].label}" → slot [${stack.length}]  ·  O(1)`,
      "success",
    );
  };

  const handleSlideInDone = () => {
    setSlidingIn(null);
    setIsAnimating(false);
  };

  // ── Pop ────────────────────────────────────────────────────────────────────
  const handlePop = () => {
    if (isAnimating) return;
    if (stack.length === 0)
      return addLog("⚠️ Stack Underflow! Nothing to pop.", "error");
    setIsAnimating(true);
    setIsPeeked(false);
    const top = stack[stack.length - 1];
    setPendingPop(top);
    setSlidingOut(top.id);
    addLog(
      `📤 Pop "${BOX_STYLES[top.styleIdx].label}" from slot [${stack.length - 1}]  ·  O(1)`,
      "success",
    );
  };

  const handleSlideOutDone = () => {
    setSlidingOut(null);
    setStack((prev) => prev.slice(0, -1));
    setPendingPop(null);
    setIsAnimating(false);
  };

  // ── Peek ───────────────────────────────────────────────────────────────────
  const handlePeek = () => {
    if (stack.length === 0)
      return addLog("⚠️ Stack is empty — nothing to peek!", "error");
    const newVal = !isPeeked;
    setIsPeeked(newVal);
    if (newVal) {
      addLog(
        `👁️ Peek → TOP slot [${stack.length - 1}] = "${BOX_STYLES[topBox.styleIdx].label}"  ·  O(1)`,
        "success",
      );
    }
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
          ? "bg-emerald-400 border-emerald-400 text-gray-900"
          : "bg-transparent border-white/20 text-white/60 hover:border-emerald-400/50 hover:text-white"
      }`}
    >
      {emoji} {label}
    </button>
  );

  return (
    <div
      className="flex flex-col gap-4 w-full"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-emerald-300 tracking-widest">
          📦 STORAGE BOXES
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Stack:{" "}
          <span className="text-emerald-300 font-bold">{stack.length}</span> /{" "}
          {MAX_SLOTS} slots
          {stack.length > 0 && (
            <>
              {" "}
              &nbsp;·&nbsp; TOP [
              <span className="text-emerald-300 font-bold">
                {stack.length - 1}
              </span>
              ] = "
              <span className="text-emerald-300 font-bold">
                {BOX_STYLES[topBox.styleIdx].label}
              </span>
              "
            </>
          )}
          {stack.length === 0 && (
            <span className="text-red-400 ml-2">[ EMPTY ]</span>
          )}
        </p>
      </div>

      {/* 3D Canvas */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-emerald-400/30 shadow-[0_0_40px_rgba(52,211,153,0.1)]"
        style={{
          height: 480,
          background:
            "linear-gradient(180deg,#050e08 0%,#0a1a10 50%,#040c06 100%)",
        }}
      >
        <Canvas camera={{ position: [2.8, 0.8, 6.0], fov: 46 }} shadows>
          <ShelfScene
            stack={stack}
            isPeeked={isPeeked}
            slidingInIdx={slidingInIdx}
            slidingOutIdx={slidingOutIdx}
            onSlideInDone={handleSlideInDone}
            onSlideOutDone={handleSlideOutDone}
          />
        </Canvas>
      </div>

      {/* Slot visualizer bar */}
      <div className="flex gap-1 flex-wrap justify-center items-end">
        <span className="text-white/30 text-xs mr-1">BOTTOM</span>
        {stack.length === 0 ? (
          <span className="text-white/20 text-xs italic px-3 py-1 border border-white/10 rounded-lg">
            [ empty stack ]
          </span>
        ) : (
          stack.map((box, i) => (
            <div
              key={box.id}
              className={`flex flex-col items-center px-2 py-1 rounded-lg border text-xs transition-all ${
                i === stack.length - 1
                  ? "border-emerald-400 bg-emerald-400/20 text-emerald-300 scale-110"
                  : "border-white/20 bg-white/10 text-white/70"
              }`}
            >
              <span className="text-base">📦</span>
              <span className="font-mono font-bold">[{i}]</span>
              {i === stack.length - 1 && (
                <span className="text-[9px] text-emerald-400 font-bold">
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
        {/* Operations */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabBtn("push", "📦", "Push")}
            {tabBtn("pop", "📤", "Pop")}
            {tabBtn("peek", "👁️", "Peek")}
          </div>

          {/* Push */}
          {activeTab === "push" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Slide a box into the TOP slot —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-white/60 text-sm">Box:</span>
                <select
                  value={pushStyleIdx}
                  onChange={(e) => setPushStyleIdx(Number(e.target.value))}
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-400"
                >
                  {BOX_STYLES.map((s, i) => (
                    <option key={i} value={i}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handlePush}
                  disabled={isAnimating || stack.length >= MAX_SLOTS}
                  className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  Push →
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${(stack.length / MAX_SLOTS) * 100}%` }}
                  />
                </div>
                <span className="text-white/40 text-xs">
                  {stack.length}/{MAX_SLOTS}
                </span>
              </div>
              {stack.length >= MAX_SLOTS && (
                <p className="text-red-400 text-xs font-bold">
                  ⚠️ Stack Overflow — shelf is full!
                </p>
              )}
            </div>
          )}

          {/* Pop */}
          {activeTab === "pop" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Slide out the TOP box —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
                &nbsp;· LIFO: last pushed = first popped
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handlePop}
                  disabled={isAnimating || stack.length === 0}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  ← Pop
                </button>
                {stack.length === 0 ? (
                  <span className="text-red-400 text-xs font-bold">
                    Stack Underflow!
                  </span>
                ) : (
                  topBox && (
                    <span className="text-white/50 text-xs">
                      Will remove:{" "}
                      <span className="text-emerald-300 font-bold">
                        {BOX_STYLES[topBox.styleIdx].icon}{" "}
                        {BOX_STYLES[topBox.styleIdx].label}
                      </span>
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* Peek */}
          {activeTab === "peek" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Inspect TOP slot without removing —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={handlePeek}
                  disabled={stack.length === 0}
                  className={`px-5 py-2.5 rounded-lg text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isPeeked
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-yellow-600 hover:bg-yellow-500"
                  }`}
                >
                  {isPeeked ? "👁️ Hide" : "👁️ Peek TOP"}
                </button>

                {isPeeked && topBox && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-400/15 border border-emerald-400/40 rounded-lg">
                    <span className="text-2xl">
                      {BOX_STYLES[topBox.styleIdx].icon}
                    </span>
                    <div>
                      <p className="text-emerald-300 text-xs font-bold">
                        TOP [{stack.length - 1}]
                      </p>
                      <p className="text-white/80 text-xs">
                        {BOX_STYLES[topBox.styleIdx].label}
                      </p>
                    </div>
                  </div>
                )}
              </div>
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
                ["Push (slide in)", "O(1)", true],
                ["Pop (slide out)", "O(1)", true],
                ["Peek TOP", "O(1)", true],
                ["isEmpty check", "O(1)", true],
                ["Search", "O(n)", false],
                ["Clear all", "O(n)", false],
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

            {/* Stack state panel */}
            <div className="mt-3 px-3 py-2 bg-emerald-400/10 border border-emerald-400/25 rounded-lg">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">isEmpty:</span>
                <span
                  className={`font-bold ${stack.length === 0 ? "text-red-400" : "text-green-400"}`}
                >
                  {stack.length === 0 ? "true" : "false"}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-white/50">isFull:</span>
                <span
                  className={`font-bold ${stack.length >= MAX_SLOTS ? "text-red-400" : "text-green-400"}`}
                >
                  {stack.length >= MAX_SLOTS ? "true" : "false"}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-white/50">size:</span>
                <span className="text-emerald-300 font-bold">
                  {stack.length}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-white/50">top:</span>
                <span className="text-emerald-300 font-bold">
                  {topBox ? `"${BOX_STYLES[topBox.styleIdx].label}"` : "null"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-white/25 text-xs pb-2">
        💡 Boxes slide in/out from the right · Drag to rotate · Scroll to zoom
      </p>
    </div>
  );
}
