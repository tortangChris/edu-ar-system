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

// ─── Color palette per product type ──────────────────────────────────────────
const PRODUCT_COLORS = {
  apple: { box: "#e74c3c", label: "#c0392b", text: "#fff" },
  milk: { box: "#ecf0f1", label: "#bdc3c7", text: "#2c3e50" },
  bread: { box: "#e67e22", label: "#d35400", text: "#fff" },
  juice: { box: "#f1c40f", label: "#f39c12", text: "#2c3e50" },
  coffee: { box: "#6f4e37", label: "#4a3728", text: "#fff" },
  cereal: { box: "#27ae60", label: "#1e8449", text: "#fff" },
  empty: { box: "#1e2a35", label: "#0f1923", text: "#7f8c8d" },
};

const PRODUCT_EMOJIS = {
  apple: "🍎",
  milk: "🥛",
  bread: "🍞",
  juice: "🧃",
  coffee: "☕",
  cereal: "🌾",
  empty: "—",
};

const PRODUCTS = ["apple", "milk", "bread", "juice", "coffee", "cereal"];
const INITIAL_ITEMS = [
  "apple",
  "milk",
  "bread",
  "juice",
  "coffee",
  "cereal",
  "empty",
  "empty",
  "apple",
  "bread",
];

// ─── Single Grocery Box ───────────────────────────────────────────────────────
function GroceryBox({ position, index, product, isSelected, onClick }) {
  const groupRef = useRef();
  const boxRef = useRef();
  const colors = PRODUCT_COLORS[product] || PRODUCT_COLORS.empty;
  const isEmpty = product === "empty";

  useEffect(() => {
    if (!groupRef.current) return;
    gsap.fromTo(
      groupRef.current.position,
      { y: position[1] + 3 },
      {
        y: position[1],
        duration: 0.6,
        ease: "bounce.out",
        delay: index * 0.07,
      },
    );
  }, []);

  useFrame((state) => {
    if (!boxRef.current) return;
    if (isSelected) {
      boxRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.15;
    } else {
      boxRef.current.rotation.y = THREE.MathUtils.lerp(
        boxRef.current.rotation.y,
        0,
        0.1,
      );
    }
  });

  const scale = isSelected ? 1.1 : 1;

  return (
    <group
      ref={groupRef}
      position={position}
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
      <group ref={boxRef} scale={[scale, scale, scale]}>
        {/* Main box body */}
        <RoundedBox args={[0.72, 0.9, 0.55]} radius={0.06} smoothness={4}>
          <meshStandardMaterial
            color={colors.box}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={isEmpty ? 0.3 : 1}
          />
        </RoundedBox>

        {/* Label on front face */}
        {!isEmpty && (
          <>
            <mesh position={[0, -0.05, 0.285]}>
              <planeGeometry args={[0.62, 0.44]} />
              <meshStandardMaterial color={colors.label} roughness={0.5} />
            </mesh>
            <Text
              position={[0, -0.05, 0.295]}
              fontSize={0.1}
              color={colors.text}
              anchorX="center"
              anchorY="middle"
              maxWidth={0.58}
            >
              {product.toUpperCase()}
            </Text>
          </>
        )}

        {/* Selection glow ring */}
        {isSelected && (
          <mesh>
            <torusGeometry args={[0.52, 0.03, 16, 60]} />
            <meshStandardMaterial
              color="#f39c12"
              emissive="#f39c12"
              emissiveIntensity={1.8}
            />
          </mesh>
        )}
      </group>

      {/* Index tag below box */}
      <group position={[0, -0.65, 0]}>
        <RoundedBox args={[0.44, 0.22, 0.08]} radius={0.04} smoothness={4}>
          <meshStandardMaterial
            color={isSelected ? "#f39c12" : "#0f1923"}
            roughness={0.4}
          />
        </RoundedBox>
        <Text
          position={[0, 0, 0.05]}
          fontSize={0.13}
          color={isSelected ? "#1a1a1a" : "#7ec8e3"}
          anchorX="center"
          anchorY="middle"
        >
          [{index}]
        </Text>
      </group>
    </group>
  );
}

// ─── Wooden Shelf Board ───────────────────────────────────────────────────────
function ShelfBoard({ y, width }) {
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <boxGeometry args={[width + 0.3, 0.08, 0.75]} />
        <meshStandardMaterial
          color="#8B6914"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[width + 0.3, 0.005, 0.75]} />
        <meshStandardMaterial color="#a0791c" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── Shelf Side Panels & Back Wall ───────────────────────────────────────────
function ShelfFrame({ height, width }) {
  return (
    <>
      <mesh position={[-(width / 2 + 0.18), height / 2 - 0.5, 0]}>
        <boxGeometry args={[0.1, height + 0.3, 0.82]} />
        <meshStandardMaterial color="#6b4f10" roughness={0.8} />
      </mesh>
      <mesh position={[width / 2 + 0.18, height / 2 - 0.5, 0]}>
        <boxGeometry args={[0.1, height + 0.3, 0.82]} />
        <meshStandardMaterial color="#6b4f10" roughness={0.8} />
      </mesh>
      <mesh position={[0, height / 2 - 0.5, -0.42]}>
        <boxGeometry args={[width + 0.55, height + 0.3, 0.06]} />
        <meshStandardMaterial color="#4a3508" roughness={0.9} />
      </mesh>
      <mesh position={[0, height - 0.25, 0]}>
        <boxGeometry args={[width + 0.55, 0.1, 0.82]} />
        <meshStandardMaterial color="#6b4f10" roughness={0.8} />
      </mesh>
    </>
  );
}

// ─── Full 3D Shelf Scene ──────────────────────────────────────────────────────
function ShelfScene({ items, selectedIndex, onSelect }) {
  const ITEM_W = 0.95;
  const ROW = Math.ceil(items.length / 2);
  const SHELF_Y = [-0.3, 1.15];
  const row0 = items.slice(0, ROW);
  const row1 = items.slice(ROW);

  const renderRow = (row, startIdx, shelfY) =>
    row.map((product, i) => (
      <GroceryBox
        key={`${startIdx + i}-${product}`}
        position={[(i - ROW / 2 + 0.5) * ITEM_W, shelfY + 0.55, 0]}
        index={startIdx + i}
        product={product}
        isSelected={selectedIndex === startIdx + i}
        onClick={onSelect}
      />
    ));

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.4}
        color="#b0c4de"
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#fff5e0" />

      <group position={[0, -0.6, 0]}>
        <ShelfFrame height={2.4} width={ROW * ITEM_W} />
        <ShelfBoard y={SHELF_Y[0]} width={ROW * ITEM_W} />
        <ShelfBoard y={SHELF_Y[1]} width={ROW * ITEM_W} />
        {renderRow(row0, 0, SHELF_Y[0])}
        {renderRow(row1, ROW, SHELF_Y[1])}
      </group>

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={4}
        maxDistance={11}
        target={[0, 0.2, 0]}
      />
      <Environment preset="city" />
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function GroceryShelf() {
  const [items, setItems] = useState([...INITIAL_ITEMS]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("access");
  const [log, setLog] = useState([]);
  const [inputs, setInputs] = useState({
    accessIdx: 0,
    insertIdx: 0,
    deleteIdx: 0,
    insertProduct: "milk",
    updateProduct: "juice",
  });

  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, id: Date.now() }, ...prev].slice(0, 8));

  const setInput = (key, val) => setInputs((prev) => ({ ...prev, [key]: val }));

  const handleSelect = (idx) => {
    setSelectedIndex((prev) => (prev === idx ? null : idx));
    addLog(`Selected [${idx}] → "${items[idx]}"`, "select");
  };

  const handleAccess = () => {
    const idx = +inputs.accessIdx;
    if (idx < 0 || idx >= items.length)
      return addLog("⚠️ Index out of bounds!", "error");
    setSelectedIndex(idx);
    addLog(`✅ Access [${idx}] → "${items[idx]}"  ·  Time: O(1)`, "success");
  };

  const handleInsert = () => {
    const idx = +inputs.insertIdx;
    if (idx < 0 || idx > items.length)
      return addLog("⚠️ Index out of bounds!", "error");
    const shifted = items.length - idx;
    const next = [...items];
    next.splice(idx, 0, inputs.insertProduct);
    setItems(next.slice(0, INITIAL_ITEMS.length));
    setSelectedIndex(idx);
    addLog(
      `➕ Insert "${inputs.insertProduct}" at [${idx}]  ·  Shifted ${shifted} right  ·  O(n)`,
      "success",
    );
  };

  const handleDelete = () => {
    const idx = +inputs.deleteIdx;
    if (idx < 0 || idx >= items.length)
      return addLog("⚠️ Index out of bounds!", "error");
    const removed = items[idx];
    const next = [...items];
    next.splice(idx, 1);
    next.push("empty");
    setItems(next);
    setSelectedIndex(null);
    addLog(
      `🗑️ Delete [${idx}] "${removed}"  ·  Shifted ${items.length - idx - 1} left  ·  O(n)`,
      "success",
    );
  };

  const handleUpdate = () => {
    if (selectedIndex === null)
      return addLog("⚠️ Select an item first!", "error");
    const old = items[selectedIndex];
    const next = [...items];
    next[selectedIndex] = inputs.updateProduct;
    setItems(next);
    addLog(
      `✏️ Update [${selectedIndex}] "${old}" → "${inputs.updateProduct}"  ·  O(1)`,
      "success",
    );
  };

  const handleReset = () => {
    setItems([...INITIAL_ITEMS]);
    setSelectedIndex(null);
    setLog([]);
  };

  const tabBtn = (tab, emoji, label) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
        activeTab === tab
          ? "bg-amber-400 border-amber-400 text-gray-900"
          : "bg-transparent border-white/20 text-white/60 hover:border-amber-400/50 hover:text-white"
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
        <h2 className="text-3xl font-bold text-amber-300 tracking-widest">
          🛒 GROCERY SHELF
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Array[{items.length}]
          {selectedIndex !== null && (
            <>
              {" "}
              &nbsp;·&nbsp; Selected:{" "}
              <span className="text-amber-300 font-bold">
                [{selectedIndex}] = "{items[selectedIndex]}"
              </span>
            </>
          )}
        </p>
      </div>

      {/* 3D Canvas */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]"
        style={{
          height: 420,
          background:
            "linear-gradient(180deg,#0d1b2a 0%,#1a2f4e 60%,#0a1628 100%)",
        }}
      >
        <Canvas camera={{ position: [0, 1.5, 7.5], fov: 42 }} shadows>
          <ShelfScene
            items={items}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
          />
        </Canvas>
      </div>

      {/* Index row */}
      <div className="flex gap-1 flex-wrap justify-center">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            className={`flex flex-col items-center px-2 py-1 rounded-lg border transition-all text-xs ${
              selectedIndex === i
                ? "border-amber-400 bg-amber-400/20 text-amber-300"
                : item === "empty"
                  ? "border-white/10 bg-white/5 text-white/30"
                  : "border-white/20 bg-white/10 text-white/80 hover:border-white/40"
            }`}
          >
            <span className="text-base leading-none">
              {PRODUCT_EMOJIS[item]}
            </span>
            <span className="font-mono font-bold">[{i}]</span>
          </button>
        ))}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Operations */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabBtn("access", "🔍", "Access")}
            {tabBtn("insert", "➕", "Insert")}
            {tabBtn("delete", "🗑️", "Delete")}
            {tabBtn("update", "✏️", "Update")}
          </div>

          {activeTab === "access" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Direct read by index —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center">
                <span className="text-white/60 text-sm">Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length - 1}
                  value={inputs.accessIdx}
                  onChange={(e) => setInput("accessIdx", e.target.value)}
                  className="w-20 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleAccess}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-bold transition-all"
                >
                  Access
                </button>
              </div>
            </div>
          )}

          {activeTab === "insert" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Insert at index, shifts elements right —{" "}
                <span className="text-red-400 font-bold">O(n)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-white/60 text-sm">Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length}
                  value={inputs.insertIdx}
                  onChange={(e) => setInput("insertIdx", e.target.value)}
                  className="w-20 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <select
                  value={inputs.insertProduct}
                  onChange={(e) => setInput("insertProduct", e.target.value)}
                  className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
                >
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {PRODUCT_EMOJIS[p]} {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleInsert}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-bold transition-all"
                >
                  Insert
                </button>
              </div>
            </div>
          )}

          {activeTab === "delete" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Remove at index, shifts elements left —{" "}
                <span className="text-red-400 font-bold">O(n)</span>
              </p>
              <div className="flex gap-2 items-center">
                <span className="text-white/60 text-sm">Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length - 1}
                  value={inputs.deleteIdx}
                  onChange={(e) => setInput("deleteIdx", e.target.value)}
                  className="w-20 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-bold transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {activeTab === "update" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Overwrite by index —{" "}
                <span className="text-green-400 font-bold">O(1)</span>. Click a
                box first.
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-white/60 text-sm">Replace with</span>
                <select
                  value={inputs.updateProduct}
                  onChange={(e) => setInput("updateProduct", e.target.value)}
                  className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
                >
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {PRODUCT_EMOJIS[p]} {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleUpdate}
                  disabled={selectedIndex === null}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  Update [{selectedIndex ?? "?"}]
                </button>
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
                            ? "border-amber-400 bg-amber-400/5 text-amber-300"
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
                ["Access", "O(1)", true],
                ["Update", "O(1)", true],
                ["Insert", "O(n)", false],
                ["Delete", "O(n)", false],
              ].map(([op, c, fast]) => (
                <div
                  key={op}
                  className="flex justify-between px-3 py-2 bg-white/5 rounded-lg"
                >
                  <span className="text-white/60">{op}</span>
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
        💡 Click boxes on the shelf to select · Drag to rotate · Scroll to zoom
      </p>
    </div>
  );
}
