import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Text,
  RoundedBox,
  OrbitControls,
  Environment,
  Line,
} from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────────────────────
const DOMINO_GAP = 1.6;
const DOMINO_W = 0.5;
const DOMINO_H = 1.0;
const DOMINO_D = 0.22;
const DOT_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
];
const NODE_COLORS = [
  "#c0392b",
  "#2980b9",
  "#27ae60",
  "#d68910",
  "#7d3c98",
  "#148f77",
  "#ba4a00",
];

const INITIAL_NODES = [
  { id: 1, value: 3, color: 0 },
  { id: 2, value: 7, color: 1 },
  { id: 3, value: 1, color: 2 },
  { id: 4, value: 5, color: 3 },
  { id: 5, value: 9, color: 4 },
];

// ─── Dot pip on domino face ───────────────────────────────────────────────────
function Pip({ position, color }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.055, 12, 12]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.2}
        emissive={color}
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

// ─── Domino face dots pattern (value 1-9) ─────────────────────────────────────
function DominoFace({ value, color, z }) {
  const patterns = {
    1: [[0, 0]],
    2: [
      [-0.13, 0.18],
      [0.13, -0.18],
    ],
    3: [
      [-0.15, 0.2],
      [0, 0],
      [0.15, -0.2],
    ],
    4: [
      [-0.13, 0.18],
      [0.13, 0.18],
      [-0.13, -0.18],
      [0.13, -0.18],
    ],
    5: [
      [-0.14, 0.19],
      [0.14, 0.19],
      [0, 0],
      [-0.14, -0.19],
      [0.14, -0.19],
    ],
    6: [
      [-0.14, 0.22],
      [0.14, 0.22],
      [-0.14, 0],
      [0.14, 0],
      [-0.14, -0.22],
      [0.14, -0.22],
    ],
    7: [
      [-0.14, 0.24],
      [0.14, 0.24],
      [-0.14, 0.06],
      [0.14, 0.06],
      [0, -0.08],
      [-0.14, -0.24],
      [0.14, -0.24],
    ],
    8: [
      [-0.14, 0.26],
      [0.14, 0.26],
      [-0.14, 0.08],
      [0.14, 0.08],
      [-0.14, -0.08],
      [0.14, -0.08],
      [-0.14, -0.26],
      [0.14, -0.26],
    ],
    9: [
      [-0.14, 0.26],
      [0, 0.26],
      [0.14, 0.26],
      [-0.14, 0],
      [0, 0],
      [0.14, 0],
      [-0.14, -0.26],
      [0, -0.26],
      [0.14, -0.26],
    ],
  };
  const dots = patterns[Math.min(Math.max(value, 1), 9)] || patterns[1];
  return (
    <>
      {dots.map((pos, i) => (
        <Pip key={i} position={[pos[0], pos[1], z]} color={color} />
      ))}
    </>
  );
}

// ─── Single Domino Node ───────────────────────────────────────────────────────
function DominoNode({
  position,
  index,
  node,
  isHead,
  isTail,
  isActive,
  isTraversed,
  isSelected,
  reversed,
  onClick,
  delay = 0,
}) {
  const groupRef = useRef();
  const tileRef = useRef();
  const glowRef = useRef();
  const baseColor = NODE_COLORS[node.color % NODE_COLORS.length];
  const dotColor = DOT_COLORS[node.color % DOT_COLORS.length];

  // Drop-in entrance
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(position[0], position[1] + 5, position[2]);
    gsap.to(groupRef.current.position, {
      y: position[1],
      duration: 0.7,
      ease: "bounce.out",
      delay,
    });
  }, []);

  // Follow position changes (reversal reorder)
  useEffect(() => {
    if (!groupRef.current) return;
    gsap.to(groupRef.current.position, {
      x: position[0],
      y: position[1],
      z: position[2],
      duration: 0.6,
      ease: "power3.inOut",
    });
  }, [position[0], position[1], position[2]]);

  // Pulse when active (traversal highlight)
  useFrame((state) => {
    if (!tileRef.current) return;
    const t = state.clock.elapsedTime;
    if (isActive) {
      tileRef.current.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    } else {
      tileRef.current.scale.setScalar(
        THREE.MathUtils.lerp(
          tileRef.current.scale.x,
          isSelected ? 1.08 : 1,
          0.12,
        ),
      );
    }
  });

  const emissiveColor = isActive
    ? "#ffffff"
    : isTraversed
      ? baseColor
      : isSelected
        ? "#f39c12"
        : "#000000";
  const emissiveInt = isActive
    ? 0.6
    : isTraversed
      ? 0.35
      : isSelected
        ? 0.4
        : 0;

  return (
    <group ref={groupRef} position={position}>
      <group
        ref={tileRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(index);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        {/* Domino tile body */}
        <RoundedBox
          args={[DOMINO_W, DOMINO_H, DOMINO_D]}
          radius={0.04}
          smoothness={4}
        >
          <meshStandardMaterial
            color={isTraversed ? baseColor : isActive ? "#ffffff" : "#1a1a2e"}
            roughness={0.25}
            metalness={0.15}
            emissive={emissiveColor}
            emissiveIntensity={emissiveInt}
          />
        </RoundedBox>

        {/* Colored top strip */}
        <mesh position={[0, DOMINO_H / 2 - 0.07, DOMINO_D / 2 + 0.001]}>
          <planeGeometry args={[DOMINO_W - 0.04, 0.12]} />
          <meshStandardMaterial
            color={baseColor}
            roughness={0.4}
            emissive={baseColor}
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Divider line */}
        <mesh position={[0, 0, DOMINO_D / 2 + 0.001]}>
          <planeGeometry args={[DOMINO_W - 0.06, 0.018]} />
          <meshStandardMaterial color={baseColor} roughness={0.4} />
        </mesh>

        {/* Data value dots on upper half */}
        <group position={[0, 0.22, 0]}>
          <DominoFace
            value={node.value}
            color={dotColor}
            z={DOMINO_D / 2 + 0.005}
          />
        </group>

        {/* Pointer section on lower half - shows next arrow */}
        <mesh position={[0, -0.28, DOMINO_D / 2 + 0.002]}>
          <planeGeometry args={[DOMINO_W - 0.08, 0.36]} />
          <meshStandardMaterial
            color="#0d0d1a"
            roughness={0.6}
            transparent
            opacity={0.7}
          />
        </mesh>
        <Text
          position={[0, -0.3, DOMINO_D / 2 + 0.012]}
          fontSize={0.09}
          color={isTail ? "#7f8c8d" : baseColor}
          anchorX="center"
          anchorY="middle"
        >
          {isTail ? "NULL" : "→ next"}
        </Text>

        {/* Selection ring */}
        {isSelected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.03, 12, 60]} />
            <meshStandardMaterial
              color="#f39c12"
              emissive="#f39c12"
              emissiveIntensity={1.5}
            />
          </mesh>
        )}
      </group>

      {/* HEAD / TAIL label above */}
      {(isHead || isTail) && (
        <group position={[0, DOMINO_H / 2 + 0.35, 0]}>
          <RoundedBox args={[0.52, 0.2, 0.06]} radius={0.03} smoothness={4}>
            <meshStandardMaterial
              color={isHead ? "#2ecc71" : "#e74c3c"}
              roughness={0.4}
              emissive={isHead ? "#2ecc71" : "#e74c3c"}
              emissiveIntensity={0.4}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.04]}
            fontSize={0.1}
            color="#fff"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {isHead && isTail ? "HEAD/TAIL" : isHead ? "HEAD" : "TAIL"}
          </Text>
        </group>
      )}

      {/* Node index tag */}
      <group position={[0, -DOMINO_H / 2 - 0.28, 0]}>
        <RoundedBox args={[0.42, 0.2, 0.06]} radius={0.03} smoothness={4}>
          <meshStandardMaterial
            color={isSelected ? "#f39c12" : "#0f1923"}
            roughness={0.4}
          />
        </RoundedBox>
        <Text
          position={[0, 0, 0.04]}
          fontSize={0.11}
          color={isSelected ? "#1a1a1a" : "#7ec8e3"}
          anchorX="center"
          anchorY="middle"
        >
          node[{index}]
        </Text>
      </group>
    </group>
  );
}

// ─── Curved arrow between domino nodes ───────────────────────────────────────
function NodeArrow({ from, to, color = "#4a90d9", reversed = false }) {
  const points = useMemo(() => {
    const mid = [(from[0] + to[0]) / 2, from[1] + 0.55, (from[2] + to[2]) / 2];
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...from),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...to),
    );
    return curve.getPoints(20);
  }, [from[0], from[1], to[0], to[1]]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2.5}
      transparent
      opacity={0.85}
    />
  );
}

// ─── Table surface ────────────────────────────────────────────────────────────
function TableSurface({ width }) {
  return (
    <group position={[0, -0.85, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[width + 2, 0.08, 2.2]} />
        <meshStandardMaterial
          color="#1e1e2e"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>
      {/* Wood-grain strips */}
      {[-0.6, -0.2, 0.2, 0.6].map((z, i) => (
        <mesh key={i} position={[0, 0.042, z]}>
          <boxGeometry args={[width + 2, 0.003, 0.12]} />
          <meshStandardMaterial color="#252540" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Main 3D Scene ────────────────────────────────────────────────────────────
function DominoScene({
  nodes,
  activeIndex,
  traversedSet,
  selectedIndex,
  onSelect,
}) {
  const totalW = (nodes.length - 1) * DOMINO_GAP;
  const offsetX = -totalW / 2;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 4]} intensity={1.1} castShadow />
      <directionalLight
        position={[-4, 3, -2]}
        intensity={0.35}
        color="#a0b8d0"
      />
      <pointLight position={[0, 3, 1.5]} intensity={0.6} color="#cce0ff" />

      <TableSurface width={totalW} />

      {/* Pointer arrows between nodes */}
      {nodes.map((node, i) => {
        if (i >= nodes.length - 1) return null;
        const fromX = offsetX + i * DOMINO_GAP + 0.26;
        const toX = offsetX + (i + 1) * DOMINO_GAP - 0.26;
        const y = -0.28;
        const isTraversedArrow = traversedSet.has(i) && traversedSet.has(i + 1);
        return (
          <NodeArrow
            key={`arrow-${i}`}
            from={[fromX, y, 0.12]}
            to={[toX, y, 0.12]}
            color={isTraversedArrow ? "#2ecc71" : "#4a5568"}
          />
        );
      })}

      {/* Domino nodes */}
      {nodes.map((node, i) => (
        <DominoNode
          key={node.id}
          position={[offsetX + i * DOMINO_GAP, 0, 0]}
          index={i}
          node={node}
          isHead={i === 0}
          isTail={i === nodes.length - 1}
          isActive={activeIndex === i}
          isTraversed={traversedSet.has(i)}
          isSelected={selectedIndex === i}
          onClick={onSelect}
          delay={i * 0.1}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.3}
        minDistance={4}
        maxDistance={14}
        target={[0, 0, 0]}
      />
      <Environment preset="night" />
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function DominoNodes() {
  const [nodes, setNodes] = useState(INITIAL_NODES.map((n, i) => ({ ...n })));
  const [selectedIndex, setSelected] = useState(null);
  const [activeIndex, setActive] = useState(null);
  const [traversedSet, setTraversed] = useState(new Set());
  const [isTraversing, setIsTraversing] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [activeTab, setActiveTab] = useState("traverse");
  const [log, setLog] = useState([]);
  const [newValue, setNewValue] = useState(4);
  const [insertPos, setInsertPos] = useState("tail");
  const [insertIdx, setInsertIdx] = useState(1);
  const traverseRef = useRef(null);

  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, id: Date.now() }, ...prev].slice(0, 8));

  const handleSelect = (idx) => {
    setSelected((prev) => (prev === idx ? null : idx));
    addLog(`Selected node[${idx}] → value: ${nodes[idx].value}`, "select");
  };

  // ── Traverse ───────────────────────────────────────────────────────────────
  const handleTraverse = () => {
    if (isTraversing) return;
    setIsTraversing(true);
    setTraversed(new Set());
    setActive(null);
    addLog("▶ Traversing from HEAD → TAIL...", "info");

    let i = 0;
    traverseRef.current = setInterval(() => {
      if (i >= nodes.length) {
        clearInterval(traverseRef.current);
        setActive(null);
        setIsTraversing(false);
        addLog(
          `✅ Traversal complete — visited ${nodes.length} nodes  ·  O(n)`,
          "success",
        );
        return;
      }
      setActive(i);
      setTraversed((prev) => new Set([...prev, i]));
      i++;
    }, 700);
  };

  const handleStopTraverse = () => {
    clearInterval(traverseRef.current);
    setIsTraversing(false);
    setActive(null);
    addLog("⏹ Traversal stopped", "info");
  };

  const resetTraverse = () => {
    clearInterval(traverseRef.current);
    setIsTraversing(false);
    setActive(null);
    setTraversed(new Set());
  };

  // ── Insert node ────────────────────────────────────────────────────────────
  const handleInsert = () => {
    resetTraverse();
    const colorIdx = Math.floor(Math.random() * DOT_COLORS.length);
    const newNode = {
      id: Date.now(),
      value: Number(newValue),
      color: colorIdx,
    };
    let next = [...nodes];
    let position = "";

    if (insertPos === "head") {
      next = [newNode, ...next];
      position = "HEAD (index 0)";
    } else if (insertPos === "tail") {
      next = [...next, newNode];
      position = `TAIL (index ${next.length - 1})`;
    } else {
      const idx = Math.min(Math.max(Number(insertIdx), 0), next.length);
      next.splice(idx, 0, newNode);
      position = `index ${idx}`;
    }
    setNodes(next);
    addLog(
      `➕ Inserted node(${newValue}) at ${position}  ·  ${insertPos === "head" || insertPos === "tail" ? "O(1)" : "O(n)"}`,
      "success",
    );
  };

  // ── Delete node ────────────────────────────────────────────────────────────
  const handleDelete = (position) => {
    resetTraverse();
    if (nodes.length <= 1)
      return addLog("⚠️ Cannot delete — only 1 node left!", "error");
    let next = [...nodes];
    let msg = "";
    if (position === "head") {
      const val = next[0].value;
      next.shift();
      msg = `🗑️ Deleted HEAD (value: ${val})  ·  O(1) — just move HEAD pointer`;
    } else if (position === "tail") {
      const val = next[next.length - 1].value;
      next.pop();
      msg = `🗑️ Deleted TAIL (value: ${val})  ·  O(n) — must traverse to find new tail`;
    } else if (selectedIndex !== null && selectedIndex < nodes.length) {
      const val = next[selectedIndex].value;
      next.splice(selectedIndex, 1);
      msg = `🗑️ Deleted node[${selectedIndex}] (value: ${val})  ·  O(n)`;
      setSelected(null);
    } else {
      return addLog("⚠️ Select a node first to delete it!", "error");
    }
    setNodes(next);
    addLog(msg, "success");
  };

  // ── Reverse ────────────────────────────────────────────────────────────────
  const handleReverse = () => {
    resetTraverse();
    setNodes((prev) => [...prev].reverse());
    setIsReversed((r) => !r);
    addLog(`🔁 List reversed! HEAD ↔ TAIL swapped  ·  O(n)`, "success");
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    resetTraverse();
    setNodes(INITIAL_NODES.map((n) => ({ ...n })));
    setSelected(null);
    setIsReversed(false);
    setLog([]);
  };

  const tabBtn = (tab, emoji, label) => (
    <button
      key={tab}
      onClick={() => {
        setActiveTab(tab);
        resetTraverse();
      }}
      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
        activeTab === tab
          ? "bg-cyan-400 border-cyan-400 text-gray-900"
          : "bg-transparent border-white/20 text-white/60 hover:border-cyan-400/50 hover:text-white"
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
        <h2 className="text-3xl font-bold text-cyan-300 tracking-widest">
          🁢 DOMINO NODES
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Linked List · {nodes.length} nodes
          {selectedIndex !== null && (
            <>
              {" "}
              &nbsp;·&nbsp; Selected:{" "}
              <span className="text-cyan-300 font-bold">
                node[{selectedIndex}] = {nodes[selectedIndex]?.value}
              </span>
            </>
          )}
          {isReversed && (
            <span className="ml-2 text-yellow-400 font-bold">[REVERSED]</span>
          )}
        </p>
      </div>

      {/* 3D Canvas */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.12)]"
        style={{
          height: 420,
          background:
            "linear-gradient(180deg,#05080f 0%,#0d1b2e 50%,#050810 100%)",
        }}
      >
        <Canvas camera={{ position: [0, 2.5, 8], fov: 45 }} shadows>
          <DominoScene
            nodes={nodes}
            activeIndex={activeIndex}
            traversedSet={traversedSet}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
          />
        </Canvas>
      </div>

      {/* Node row display */}
      <div className="flex gap-1 flex-wrap justify-center items-center">
        <span className="text-green-400 text-xs font-bold mr-1">HEAD</span>
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-1">
            <button
              onClick={() => handleSelect(i)}
              className={`flex flex-col items-center px-2 py-1 rounded-lg border transition-all text-xs ${
                selectedIndex === i
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                  : traversedSet.has(i)
                    ? "border-green-400 bg-green-400/10 text-green-300"
                    : activeIndex === i
                      ? "border-white bg-white/20 text-white"
                      : "border-white/20 bg-white/10 text-white/80 hover:border-white/40"
              }`}
            >
              <span className="font-mono font-bold text-base">
                {node.value}
              </span>
              <span className="text-white/40">[{i}]</span>
            </button>
            {i < nodes.length - 1 && (
              <span
                className={`text-sm ${traversedSet.has(i) && traversedSet.has(i + 1) ? "text-green-400" : "text-white/30"}`}
              >
                →
              </span>
            )}
          </div>
        ))}
        <span className="text-red-400 text-xs font-bold ml-1">TAIL</span>
        <span className="text-white/30 text-xs ml-1">→ NULL</span>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Operations */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabBtn("traverse", "▶", "Traverse")}
            {tabBtn("insert", "➕", "Insert")}
            {tabBtn("delete", "🗑️", "Delete")}
            {tabBtn("reverse", "🔁", "Reverse")}
          </div>

          {/* Traverse */}
          {activeTab === "traverse" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Visit each node from HEAD → TAIL following next pointers —{" "}
                <span className="text-red-400 font-bold">O(n)</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleTraverse}
                  disabled={isTraversing}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  {isTraversing ? "⏳ Traversing..." : "▶ Start Traversal"}
                </button>
                {isTraversing && (
                  <button
                    onClick={handleStopTraverse}
                    className="px-4 py-2.5 bg-red-700 hover:bg-red-600 rounded-lg text-white text-sm font-bold transition-all"
                  >
                    ⏹ Stop
                  </button>
                )}
                <button
                  onClick={() => {
                    resetTraverse();
                    setTraversed(new Set());
                  }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white/70 text-sm transition-all"
                >
                  Reset
                </button>
              </div>
              <div className="text-xs text-white/40 mt-1">
                Progress: {traversedSet.size} / {nodes.length} nodes visited
                <div className="mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                    style={{
                      width: `${(traversedSet.size / nodes.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Insert */}
          {activeTab === "insert" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Insert at HEAD/TAIL —{" "}
                <span className="text-green-400 font-bold">O(1)</span>{" "}
                &nbsp;|&nbsp; Insert at index —{" "}
                <span className="text-red-400 font-bold">O(n)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-white/60 text-sm">Value</span>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-16 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-400"
                />
                <select
                  value={insertPos}
                  onChange={(e) => setInsertPos(e.target.value)}
                  className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400"
                >
                  <option value="head">At HEAD</option>
                  <option value="tail">At TAIL</option>
                  <option value="index">At Index</option>
                </select>
                {insertPos === "index" && (
                  <input
                    type="number"
                    min={0}
                    max={nodes.length}
                    value={insertIdx}
                    onChange={(e) => setInsertIdx(e.target.value)}
                    className="w-16 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-400"
                  />
                )}
                <button
                  onClick={handleInsert}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-bold transition-all"
                >
                  Insert
                </button>
              </div>
            </div>
          )}

          {/* Delete */}
          {activeTab === "delete" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Delete HEAD —{" "}
                <span className="text-green-400 font-bold">O(1)</span>{" "}
                &nbsp;|&nbsp; Delete TAIL or by index —{" "}
                <span className="text-red-400 font-bold">O(n)</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleDelete("head")}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white text-sm font-bold transition-all"
                >
                  Delete HEAD
                </button>
                <button
                  onClick={() => handleDelete("tail")}
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-white text-sm font-bold transition-all"
                >
                  Delete TAIL
                </button>
                <button
                  onClick={() => handleDelete("selected")}
                  disabled={selectedIndex === null}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  Delete [{selectedIndex ?? "?"}]
                </button>
              </div>
              <p className="text-white/30 text-xs">
                Click a domino to select it for deletion
              </p>
            </div>
          )}

          {/* Reverse */}
          {activeTab === "reverse" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Reverse all next-pointers —{" "}
                <span className="text-red-400 font-bold">O(n)</span>{" "}
                &nbsp;·&nbsp; HEAD and TAIL swap positions
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReverse}
                  className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-white text-sm font-bold transition-all"
                >
                  🔁 Reverse List
                </button>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10 text-xs text-white/50">
                  State:{" "}
                  <span
                    className={`font-bold ${isReversed ? "text-yellow-400" : "text-green-400"}`}
                  >
                    {isReversed ? "Reversed" : "Original"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-sm transition-all"
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
                          : entry.type === "select"
                            ? "border-cyan-400 bg-cyan-400/5 text-cyan-300"
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
                ["Insert HEAD", "O(1)", true],
                ["Insert TAIL", "O(1)", true],
                ["Insert Index", "O(n)", false],
                ["Delete HEAD", "O(1)", true],
                ["Delete TAIL", "O(n)", false],
                ["Traverse", "O(n)", false],
                ["Search", "O(n)", false],
                ["Reverse", "O(n)", false],
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
          </div>
        </div>
      </div>

      <p className="text-center text-white/25 text-xs pb-2">
        💡 Click dominos to select · Drag to rotate · Scroll to zoom
      </p>
    </div>
  );
}
