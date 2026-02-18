import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Text,
  RoundedBox,
  OrbitControls,
  Environment,
} from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";

// ─── Color palette ────────────────────────────────────────────────────────────
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

// ─── Raw WebXR Hit-Test Manager ───────────────────────────────────────────────
//
//  Pattern directly ported from:
//  https://immersive-web.github.io/webxr-samples/hit-test.html
//
//  Key decisions that match the sample:
//   • requiredFeatures: ['local', 'hit-test']
//   • viewer space  → requestHitTestSource  (ray shoots from camera center)
//   • local  space  → getPose()             (world-locked object placement)
//   • reticle.matrix = hitPose.transform.matrix  (exactly like the sample)
//   • addARObjectAt(reticle.matrix) on select     (one-time, no repositioning)
//
class WebXRHitTestManager {
  constructor() {
    this.session = null;
    this.refSpace = null; // 'local'  — world anchor
    this.viewerSpace = null; // 'viewer' — ray origin
    this.hitTestSource = null;
    this.onFrame = null; // (frame, pose, hitResults, refSpace) => void
  }

  async checkSupport() {
    if (!navigator.xr) return false;
    return navigator.xr.isSessionSupported("immersive-ar");
  }

  // Start AR session — mirrors onRequestSession() + onSessionStarted()
  async startSession(existingCanvas) {
    this.session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local", "hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.getElementById("ar-overlay") },
    });

    // Reuse the existing Three.js / R3F WebGL context
    const gl =
      existingCanvas.getContext("webgl2", { xrCompatible: true }) ||
      existingCanvas.getContext("webgl", { xrCompatible: true });

    this.session.updateRenderState({
      baseLayer: new XRWebGLLayer(this.session, gl),
    });

    // viewer space → hit-test source (ray from camera center, same as sample)
    this.viewerSpace = await this.session.requestReferenceSpace("viewer");
    this.hitTestSource = await this.session.requestHitTestSource({
      space: this.viewerSpace,
    });

    // local space → world-locked anchor for placed objects
    this.refSpace = await this.session.requestReferenceSpace("local");

    this.session.addEventListener("end", () => this._cleanup());

    // Kick off the XR frame loop (mirrors session.requestAnimationFrame in sample)
    this.session.requestAnimationFrame((t, f) => this._loop(t, f));

    return this.session;
  }

  // XR frame loop — mirrors onXRFrame() from the sample exactly
  _loop(t, frame) {
    const pose = frame.getViewerPose(this.refSpace);
    let hitResults = [];

    if (this.hitTestSource && pose) {
      hitResults = frame.getHitTestResults(this.hitTestSource);
    }

    if (this.onFrame) this.onFrame(frame, pose, hitResults, this.refSpace);

    frame.session.requestAnimationFrame((t, f) => this._loop(t, f));
  }

  endSession() {
    if (this.hitTestSource) {
      this.hitTestSource.cancel();
    }
    if (this.session) {
      this.session.end();
    }
    this._cleanup();
  }

  _cleanup() {
    this.session = this.refSpace = this.viewerSpace = this.hitTestSource = null;
  }
}

// Singleton — one manager for the whole app lifetime
const xrManager = new WebXRHitTestManager();

// ─── Reticle mesh — updated directly from XR frame loop (no React state) ──────
function Reticle({ reticleRef }) {
  return (
    <group ref={reticleRef} visible={false} matrixAutoUpdate={false}>
      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 36]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Soft outer halo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.17, 0.19, 36]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Center dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.025, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

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
    boxRef.current.rotation.y = isSelected
      ? Math.sin(state.clock.elapsedTime * 2) * 0.15
      : THREE.MathUtils.lerp(boxRef.current.rotation.y, 0, 0.1);
  });

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
      <group ref={boxRef} scale={isSelected ? 1.1 : 1}>
        <RoundedBox args={[0.72, 0.9, 0.55]} radius={0.06} smoothness={4}>
          <meshStandardMaterial
            color={colors.box}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={isEmpty ? 0.3 : 1}
          />
        </RoundedBox>
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

// ─── Full scene (3D + AR) ─────────────────────────────────────────────────────
function ShelfScene({
  items,
  selectedIndex,
  onSelect,
  isAR,
  placedMatrix,
  reticleRef,
}) {
  const ITEM_W = 0.95;
  const ROW = Math.ceil(items.length / 2);
  const SHELF_Y = [-0.3, 1.15];
  const row0 = items.slice(0, ROW);
  const row1 = items.slice(ROW);

  const shelfRef = useRef();
  const AR_SCALE = 0.28;

  // When placement confirmed — apply the hit-pose matrix + scale to shelf group
  // Mirrors: newFlower.matrix = reticle.matrix  from the Immersive Web sample
  useEffect(() => {
    if (!placedMatrix || !shelfRef.current) return;
    const m = new THREE.Matrix4().fromArray(placedMatrix);
    // Scale shelf to real-world size
    m.scale(new THREE.Vector3(AR_SCALE, AR_SCALE, AR_SCALE));
    shelfRef.current.matrix.copy(m);
    shelfRef.current.matrixAutoUpdate = false;
  }, [placedMatrix]);

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
      <ambientLight intensity={isAR ? 1.2 : 0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={isAR ? 0.7 : 1.2}
        castShadow
      />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.4}
        color="#b0c4de"
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#fff5e0" />

      {/* Reticle — only rendered in AR scanning phase */}
      {isAR && <Reticle reticleRef={reticleRef} />}

      {/* Shelf — normal 3D always; AR only after placement */}
      {(!isAR || placedMatrix) && (
        <group ref={shelfRef} {...(!isAR ? { position: [0, -0.6, 0] } : {})}>
          <ShelfFrame height={2.4} width={ROW * ITEM_W} />
          <ShelfBoard y={SHELF_Y[0]} width={ROW * ITEM_W} />
          <ShelfBoard y={SHELF_Y[1]} width={ROW * ITEM_W} />
          {renderRow(row0, 0, SHELF_Y[0])}
          {renderRow(row1, ROW, SHELF_Y[1])}
        </group>
      )}

      {!isAR && (
        <>
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
      )}
    </>
  );
}

// ─── AR DOM Overlay ───────────────────────────────────────────────────────────
function AROverlay({
  isAR,
  reticleVisible,
  placed,
  onPlace,
  onExit,
  items,
  selectedIndex,
  activeTab,
  inputs,
  log,
  onAccess,
  onInsert,
  onDelete,
  onUpdate,
  onReset,
  setInput,
  setActiveTab,
}) {
  if (!isAR) return null;

  return (
    <div
      id="ar-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        fontFamily: "'Courier New', monospace",
      }}
    >
      {/* ── SCANNING: no surface yet ── */}
      {!placed && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingBottom: 52,
            gap: 14,
            pointerEvents: "auto",
          }}
        >
          {/* Status chip */}
          <div
            style={{
              background: "rgba(0,0,0,0.75)",
              border: `1px solid ${reticleVisible ? "rgba(46,204,113,0.5)" : "rgba(243,156,18,0.4)"}`,
              borderRadius: 14,
              padding: "11px 24px",
              textAlign: "center",
              transition: "border-color 0.3s",
            }}
          >
            <div
              style={{
                color: reticleVisible ? "#2ecc71" : "#f39c12",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              {reticleVisible
                ? "✅ Surface detected!"
                : "🔍 Scanning for flat surface…"}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                marginTop: 3,
              }}
            >
              {reticleVisible
                ? "Tap the button below to place the shelf here"
                : "Point camera at a table or floor and move slowly"}
            </div>
          </div>

          {/* PLACE button — only when reticle has a hit (mirrors sample's onSelect guard) */}
          {reticleVisible && (
            <button
              onClick={onPlace}
              style={{
                background: "linear-gradient(135deg,#f39c12,#e67e22)",
                border: "none",
                borderRadius: 50,
                padding: "15px 38px",
                color: "#1a1a1a",
                fontWeight: "bold",
                fontSize: 17,
                cursor: "pointer",
                boxShadow: "0 0 30px rgba(243,156,18,0.6)",
                fontFamily: "'Courier New', monospace",
              }}
            >
              📦 Place Shelf Here
            </button>
          )}

          <button
            onClick={onExit}
            style={{
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              padding: "8px 22px",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ✕ Cancel AR
          </button>
        </div>
      )}

      {/* ── PLACED: operation HUD ── */}
      {placed && (
        <>
          {/* Top bar */}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              right: 14,
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(243,156,18,0.3)",
              borderRadius: 12,
              padding: "8px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              pointerEvents: "auto",
            }}
          >
            <span
              style={{ color: "#f39c12", fontWeight: "bold", fontSize: 13 }}
            >
              🛒 GROCERY SHELF — AR
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
              Array[{items.length}]
              {selectedIndex !== null
                ? ` · [${selectedIndex}]="${items[selectedIndex]}"`
                : ""}
            </span>
          </div>

          {/* Tab bar */}
          <div
            style={{
              position: "absolute",
              bottom: 218,
              left: 14,
              right: 14,
              display: "flex",
              gap: 7,
              justifyContent: "center",
              pointerEvents: "auto",
            }}
          >
            {[
              ["access", "🔍", "Access"],
              ["insert", "➕", "Insert"],
              ["delete", "🗑️", "Delete"],
              ["update", "✏️", "Update"],
            ].map(([tab, emoji, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 13px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: "bold",
                  border: "2px solid",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  background:
                    activeTab === tab ? "#f39c12" : "rgba(0,0,0,0.78)",
                  borderColor:
                    activeTab === tab ? "#f39c12" : "rgba(255,255,255,0.2)",
                  color:
                    activeTab === tab ? "#1a1a1a" : "rgba(255,255,255,0.75)",
                }}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Operation panel */}
          <div
            style={{
              position: "absolute",
              bottom: 82,
              left: 14,
              right: 14,
              background: "rgba(0,0,0,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: "14px 16px",
              pointerEvents: "auto",
            }}
          >
            {activeTab === "access" && (
              <HudRow>
                <HudLabel>Index</HudLabel>
                <HudNumInput
                  value={inputs.accessIdx}
                  max={items.length - 1}
                  onChange={(v) => setInput("accessIdx", v)}
                />
                <HudBtn color="#2980b9" onClick={onAccess}>
                  Access <HudBadge green>O(1)</HudBadge>
                </HudBtn>
              </HudRow>
            )}
            {activeTab === "insert" && (
              <HudRow wrap>
                <HudLabel>Index</HudLabel>
                <HudNumInput
                  value={inputs.insertIdx}
                  max={items.length}
                  onChange={(v) => setInput("insertIdx", v)}
                />
                <HudProdSelect
                  value={inputs.insertProduct}
                  onChange={(v) => setInput("insertProduct", v)}
                />
                <HudBtn color="#27ae60" onClick={onInsert}>
                  Insert <HudBadge>O(n)</HudBadge>
                </HudBtn>
              </HudRow>
            )}
            {activeTab === "delete" && (
              <HudRow>
                <HudLabel>Index</HudLabel>
                <HudNumInput
                  value={inputs.deleteIdx}
                  max={items.length - 1}
                  onChange={(v) => setInput("deleteIdx", v)}
                />
                <HudBtn color="#c0392b" onClick={onDelete}>
                  Delete <HudBadge>O(n)</HudBadge>
                </HudBtn>
              </HudRow>
            )}
            {activeTab === "update" && (
              <HudRow wrap>
                <HudLabel>Replace with</HudLabel>
                <HudProdSelect
                  value={inputs.updateProduct}
                  onChange={(v) => setInput("updateProduct", v)}
                />
                <HudBtn
                  color={selectedIndex === null ? "#555" : "#8e44ad"}
                  disabled={selectedIndex === null}
                  onClick={onUpdate}
                >
                  Update [{selectedIndex ?? "?"}]{" "}
                  <HudBadge green>O(1)</HudBadge>
                </HudBtn>
              </HudRow>
            )}
            {log.length > 0 && (
              <div
                style={{
                  marginTop: 9,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color:
                    log[0].type === "success"
                      ? "#7fe0a0"
                      : log[0].type === "error"
                        ? "#ff8080"
                        : "#f39c12",
                }}
              >
                {log[0].msg}
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 14,
              right: 14,
              display: "flex",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={onReset}
              style={{
                ...hudBtnBase,
                background: "rgba(255,255,255,0.12)",
                flex: 1,
              }}
            >
              🔄 Reset
            </button>
            <button
              onClick={onExit}
              style={{
                ...hudBtnBase,
                background: "rgba(180,30,30,0.78)",
                flex: 1,
              }}
            >
              ✕ Exit AR
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── HUD micro-components ──────────────────────────────────────────────────────
const hudBtnBase = {
  padding: "9px 14px",
  borderRadius: 9,
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "monospace",
};
const HudRow = ({ children, wrap }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: wrap ? "wrap" : "nowrap",
    }}
  >
    {children}
  </div>
);
const HudLabel = ({ children }) => (
  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
    {children}
  </span>
);
const HudBadge = ({ children, green }) => (
  <span
    style={{
      color: green ? "#7fe0a0" : "#ff9e9e",
      fontSize: 10,
      marginLeft: 2,
    }}
  >
    {children}
  </span>
);
const HudBtn = ({ children, color, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      ...hudBtnBase,
      background: color,
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    {children}
  </button>
);
const HudNumInput = ({ value, onChange, max }) => (
  <input
    type="number"
    min={0}
    max={max}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width: 56,
      padding: "6px 9px",
      background: "rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 8,
      color: "#f39c12",
      fontFamily: "monospace",
      fontSize: 13,
    }}
  />
);
const HudProdSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      padding: "6px 9px",
      background: "rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 8,
      color: "#fff",
      fontSize: 13,
    }}
  >
    {PRODUCTS.map((p) => (
      <option key={p} value={p}>
        {PRODUCT_EMOJIS[p]} {p}
      </option>
    ))}
  </select>
);

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

  // AR state
  const [isAR, setIsAR] = useState(false);
  const [arSupported, setArSupported] = useState(null);
  const [reticleVisible, setReticleVisible] = useState(false);

  // placedMatrix: Float32Array — the XR world pose matrix of placement point
  // null = scanning phase; set once when user taps "Place Shelf Here"
  const [placedMatrix, setPlacedMatrix] = useState(null);

  // Refs that bypass React state (mutated directly in XR frame loop for perf)
  const reticleRef = useRef(); // Three.js group for the reticle mesh
  const latestHitRef = useRef(null); // most recent hit pose matrix (Float32Array)

  // Check support on mount
  useEffect(() => {
    xrManager.checkSupport().then(setArSupported);
  }, []);

  // Register the XR frame callback
  // This is the equivalent of onXRFrame() in the Immersive Web sample:
  //   • show/hide reticle based on hitResults
  //   • store latest hit matrix in a ref (not state) so "Place" reads it synchronously
  useEffect(() => {
    xrManager.onFrame = (frame, pose, hitResults, refSpace) => {
      if (!reticleRef.current) return;

      if (hitResults.length > 0) {
        const hitPose = hitResults[0].getPose(refSpace);
        // Apply hit pose matrix directly to reticle — same as sample:
        // reticle.visible = true; reticle.matrix = pose.transform.matrix;
        reticleRef.current.visible = true;
        reticleRef.current.matrix.fromArray(hitPose.transform.matrix);
        reticleRef.current.matrix.decompose(
          reticleRef.current.position,
          reticleRef.current.quaternion,
          reticleRef.current.scale,
        );
        latestHitRef.current = hitPose.transform.matrix; // save for placement
        setReticleVisible(true);
      } else {
        reticleRef.current.visible = false;
        latestHitRef.current = null;
        setReticleVisible(false);
      }
    };
  }, []);

  // ── DS operation handlers (unchanged from original) ──
  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, id: Date.now() }, ...prev].slice(0, 8));
  const setInput = (key, val) => setInputs((p) => ({ ...p, [key]: val }));

  const handleSelect = (idx) => {
    setSelectedIndex((p) => (p === idx ? null : idx));
    addLog(`Selected [${idx}] → "${items[idx]}"`, "select");
  };
  const handleAccess = () => {
    const idx = +inputs.accessIdx;
    if (idx < 0 || idx >= items.length)
      return addLog("⚠️ Index out of bounds!", "error");
    setSelectedIndex(idx);
    addLog(`✅ Access [${idx}] → "${items[idx]}"  ·  O(1)`, "success");
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
      `➕ Insert "${inputs.insertProduct}" at [${idx}]  ·  Shifted ${shifted}  ·  O(n)`,
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
    addLog(`🗑️ Delete [${idx}] "${removed}"  ·  O(n)`, "success");
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

  // ── AR handlers ──
  const handleEnterAR = useCallback(async () => {
    try {
      const canvas = document.querySelector("canvas");
      await xrManager.startSession(canvas);
      setIsAR(true);
      setPlacedMatrix(null);
      setReticleVisible(false);
    } catch (err) {
      console.error("AR session failed:", err);
      alert(
        "Could not start AR. Make sure you're on Android Chrome 81+ over HTTPS.",
      );
    }
  }, []);

  // ONE-TIME placement — mirrors addARObjectAt(reticle.matrix) from the sample.
  // We read latestHitRef synchronously so we get the exact frame's matrix.
  // After this, reticle is hidden and shelf is locked to world space.
  const handlePlace = useCallback(() => {
    if (!latestHitRef.current) return;
    // Copy the Float32Array so it doesn't get mutated by the next frame
    setPlacedMatrix(new Float32Array(latestHitRef.current));
    if (reticleRef.current) reticleRef.current.visible = false;
    setReticleVisible(false);
  }, []);

  const handleExitAR = useCallback(() => {
    xrManager.endSession();
    setIsAR(false);
    setPlacedMatrix(null);
    setReticleVisible(false);
  }, []);

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
      {/* AR Overlay — DOM element; shown over camera in AR via dom-overlay */}
      <AROverlay
        isAR={isAR}
        reticleVisible={reticleVisible}
        placed={!!placedMatrix}
        onPlace={handlePlace}
        onExit={handleExitAR}
        items={items}
        selectedIndex={selectedIndex}
        activeTab={activeTab}
        inputs={inputs}
        log={log}
        onAccess={handleAccess}
        onInsert={handleInsert}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onReset={handleReset}
        setInput={setInput}
        setActiveTab={setActiveTab}
      />

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

      {/* AR not supported notice */}
      {arSupported === false && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-xl text-sm">
          <span className="text-xl">📵</span>
          <div>
            <div className="text-red-400 font-bold">
              AR Not Supported on this device
            </div>
            <div className="text-white/40 text-xs">
              Android Chrome 81+ required. iOS Safari blocks WebXR AR.
            </div>
          </div>
        </div>
      )}

      {/* AR Enter button */}
      {!isAR && arSupported && (
        <div className="flex justify-end">
          <button
            onClick={handleEnterAR}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg,#f39c12,#e67e22)",
              color: "#1a1a1a",
              fontWeight: "bold",
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(243,156,18,0.4)",
              fontFamily: "'Courier New', monospace",
            }}
          >
            📱 Enter AR Mode
          </button>
        </div>
      )}

      {/* 3D Canvas — hidden in AR (WebXR session handles its own render loop) */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]"
        style={{
          height: 420,
          background:
            "linear-gradient(180deg,#0d1b2a 0%,#1a2f4e 60%,#0a1628 100%)",
          display: isAR ? "none" : "block",
        }}
      >
        <Canvas camera={{ position: [0, 1.5, 7.5], fov: 42 }} shadows>
          <ShelfScene
            items={items}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            isAR={isAR}
            placedMatrix={placedMatrix}
            reticleRef={reticleRef}
          />
        </Canvas>
      </div>

      {/* ── Normal 3D UI (hidden in AR) ── */}
      {!isAR && (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    Insert at index —{" "}
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
                      onChange={(e) =>
                        setInput("insertProduct", e.target.value)
                      }
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
                    Remove at index —{" "}
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
                    <span className="text-green-400 font-bold">O(1)</span>.
                    Click a box first.
                  </p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-white/60 text-sm">Replace with</span>
                    <select
                      value={inputs.updateProduct}
                      onChange={(e) =>
                        setInput("updateProduct", e.target.value)
                      }
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
            💡 Click boxes to select · Drag to rotate · Scroll to zoom
          </p>
        </>
      )}
    </div>
  );
}
