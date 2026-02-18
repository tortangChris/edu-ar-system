import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

// ─── Raw WebXR Session Manager ────────────────────────────────────────────────
class XRSessionManager {
  constructor() {
    this.session = null;
    this.refSpace = null;
    this.viewerSpace = null;
    this.hitTestSource = null;
    this.hitMatrix = null;
    this.isActive = false;
    this.onHit = null;
    this.onEnd = null;
    this.onSelect = null;
  }

  async start(renderer) {
    if (!navigator.xr) throw new Error("WebXR not available on this browser.");

    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported)
      throw new Error("immersive-ar not supported on this device.");

    // Camera permission first — clear error message if denied
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (err.name === "NotAllowedError") {
        throw new Error(
          "Camera access denied. Please tap 'Allow' when prompted, then try again.",
        );
      }
      throw new Error("Camera error: " + err.message);
    }

    // FIX 1: Get the raw WebGL context from the canvas element
    const canvas = renderer.domElement;
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) throw new Error("Could not get WebGL context from canvas.");

    // FIX 2: makeXRCompatible on the raw GL context
    try {
      await gl.makeXRCompatible();
    } catch (e) {
      // Some browsers don't need this or throw — safe to ignore
      console.warn("makeXRCompatible:", e);
    }

    const overlayRoot = document.getElementById("ar-overlay");

    const sessionInit = {
      requiredFeatures: ["local", "hit-test"],
    };

    if (overlayRoot) {
      sessionInit.optionalFeatures = ["dom-overlay"];
      sessionInit.domOverlay = { root: overlayRoot };
    }

    this.session = await navigator.xr.requestSession(
      "immersive-ar",
      sessionInit,
    );

    // FIX 3: Pass the raw GL context to XRWebGLLayer, not the renderer
    const baseLayer = new XRWebGLLayer(this.session, gl);
    this.session.updateRenderState({ baseLayer });

    // FIX 4: Tell Three.js renderer to use this XR session
    renderer.xr.enabled = true;
    await renderer.xr.setSession(this.session);

    this.session.addEventListener("end", () => {
      this.hitTestSource = null;
      this.session = null;
      this.refSpace = null;
      this.viewerSpace = null;
      this.hitMatrix = null;
      this.isActive = false;
      renderer.xr.enabled = false;
      this.onEnd?.();
    });

    this.session.addEventListener("select", () => {
      if (this.hitMatrix && this.onSelect) {
        this.onSelect(this.hitMatrix.clone());
      }
    });

    this.viewerSpace = await this.session.requestReferenceSpace("viewer");
    this.hitTestSource = await this.session.requestHitTestSource({
      space: this.viewerSpace,
    });
    this.refSpace = await this.session.requestReferenceSpace("local");

    this.isActive = true;
    return this.session;
  }

  processFrame(frame) {
    if (!this.hitTestSource || !this.refSpace || !frame) return;
    const results = frame.getHitTestResults(this.hitTestSource);
    if (results.length > 0) {
      const pose = results[0].getPose(this.refSpace);
      if (pose) {
        this.hitMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
        this.onHit?.(this.hitMatrix);
        return;
      }
    }
    this.hitMatrix = null;
    this.onHit?.(null);
  }

  end() {
    this.hitTestSource?.cancel();
    this.hitTestSource = null;
    this.session?.end();
  }
}

const xrManager = new XRSessionManager();

// ─── Reticle ──────────────────────────────────────────────────────────────────
function Reticle({ hitMatrix }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    if (hitMatrix) {
      ref.current.visible = true;
      ref.current.matrix.copy(hitMatrix);
      ref.current.matrix.decompose(
        ref.current.position,
        ref.current.quaternion,
        ref.current.scale,
      );
    } else {
      ref.current.visible = false;
    }
  }, [hitMatrix]);

  return (
    <group ref={ref} visible={false} matrixAutoUpdate={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.13, 32]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.175, 32]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.025, 16]} />
        <meshBasicMaterial
          color="#fff"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── XR Frame Bridge ──────────────────────────────────────────────────────────
// FIX 5: Removed manual gl.xr.enabled toggle here — now handled in XRSessionManager
function XRFrameBridge({ isAR }) {
  useFrame((state) => {
    if (!isAR || !xrManager.isActive) return;
    // FIX 6: Use state.gl.xr.getFrame() correctly
    const frame = state.gl.xr.getFrame?.();
    if (frame) xrManager.processFrame(frame);
  });

  return null;
}

// ─── Grocery Box ──────────────────────────────────────────────────────────────
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

function ShelfContents({ items, selectedIndex, onSelect }) {
  const ITEM_W = 0.95;
  const ROW = Math.ceil(items.length / 2);
  const SHELF_Y = [-0.3, 1.15];
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
      <ShelfFrame height={2.4} width={ROW * ITEM_W} />
      <ShelfBoard y={SHELF_Y[0]} width={ROW * ITEM_W} />
      <ShelfBoard y={SHELF_Y[1]} width={ROW * ITEM_W} />
      {renderRow(items.slice(0, ROW), 0, SHELF_Y[0])}
      {renderRow(items.slice(ROW), ROW, SHELF_Y[1])}
    </>
  );
}

function ShelfScene({
  items,
  selectedIndex,
  onSelect,
  isAR,
  placedMatrix,
  hitMatrix,
}) {
  const AR_SCALE = 0.28;
  const anchorRef = useRef();

  useEffect(() => {
    if (!anchorRef.current || !placedMatrix) return;
    placedMatrix.decompose(
      anchorRef.current.position,
      anchorRef.current.quaternion,
      anchorRef.current.scale,
    );
    anchorRef.current.scale.set(AR_SCALE, AR_SCALE, AR_SCALE);
  }, [placedMatrix]);

  return (
    <>
      <ambientLight intensity={isAR ? 1.2 : 0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={isAR ? 0.6 : 1.2}
        castShadow
      />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.4}
        color="#b0c4de"
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#fff5e0" />

      <XRFrameBridge isAR={isAR} />

      {isAR && !placedMatrix && <Reticle hitMatrix={hitMatrix} />}

      {!isAR && (
        <group position={[0, -0.6, 0]}>
          <ShelfContents
            items={items}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
          />
        </group>
      )}

      {isAR && placedMatrix && (
        <group ref={anchorRef}>
          <ShelfContents
            items={items}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
          />
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

// ─── AR Overlay ───────────────────────────────────────────────────────────────
function AROverlay({
  isAR,
  placedMatrix,
  hasHit,
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
  onExit,
}) {
  return (
    <div
      id="ar-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        fontFamily: "'Courier New', monospace",
        display: isAR ? "block" : "none",
      }}
    >
      {isAR && !placedMatrix && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.72)",
              border: "1px solid rgba(243,156,18,0.5)",
              borderRadius: 14,
              padding: "12px 24px",
              color: "#f39c12",
              fontSize: 14,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {hasHit ? "🎯 Surface detected!" : "📷 Scanning for surface..."}
            <div
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 12,
                fontWeight: "normal",
                marginTop: 4,
              }}
            >
              {hasHit
                ? "Tap the screen to place the shelf"
                : "Move your phone slowly over a flat table or floor"}
            </div>
          </div>
          <button
            onClick={onExit}
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              padding: "8px 20px",
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {isAR && placedMatrix && (
        <>
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              background: "rgba(0,0,0,0.78)",
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
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
              Array[{items.length}]
              {selectedIndex !== null ? ` · [${selectedIndex}]` : ""}
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 190,
              left: 16,
              right: 16,
              display: "flex",
              gap: 6,
              justifyContent: "center",
              flexWrap: "wrap",
              pointerEvents: "auto",
            }}
          >
            {[
              ["access", "🔍", "Access"],
              ["insert", "➕", "Insert"],
              ["delete", "🗑️", "Delete"],
              ["update", "✏️", "Update"],
            ].map(([tab, icon, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: "bold",
                  border: "2px solid",
                  cursor: "pointer",
                  background:
                    activeTab === tab ? "#f39c12" : "rgba(0,0,0,0.78)",
                  borderColor:
                    activeTab === tab ? "#f39c12" : "rgba(255,255,255,0.2)",
                  color:
                    activeTab === tab ? "#1a1a1a" : "rgba(255,255,255,0.78)",
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: 16,
              right: 16,
              background: "rgba(0,0,0,0.84)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: "14px 16px",
              pointerEvents: "auto",
            }}
          >
            {activeTab === "access" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={lbl}>Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length - 1}
                  value={inputs.accessIdx}
                  onChange={(e) => setInput("accessIdx", e.target.value)}
                  style={inp}
                />
                <button
                  onClick={onAccess}
                  style={{ ...btn, background: "#2980b9" }}
                >
                  Access{" "}
                  <span style={{ color: "#7fe0a0", fontSize: 10 }}>O(1)</span>
                </button>
              </div>
            )}
            {activeTab === "insert" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={lbl}>Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length}
                  value={inputs.insertIdx}
                  onChange={(e) => setInput("insertIdx", e.target.value)}
                  style={inp}
                />
                <select
                  value={inputs.insertProduct}
                  onChange={(e) => setInput("insertProduct", e.target.value)}
                  style={sel}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {PRODUCT_EMOJIS[p]} {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onInsert}
                  style={{ ...btn, background: "#27ae60" }}
                >
                  Insert{" "}
                  <span style={{ color: "#ffaaaa", fontSize: 10 }}>O(n)</span>
                </button>
              </div>
            )}
            {activeTab === "delete" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={lbl}>Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length - 1}
                  value={inputs.deleteIdx}
                  onChange={(e) => setInput("deleteIdx", e.target.value)}
                  style={inp}
                />
                <button
                  onClick={onDelete}
                  style={{ ...btn, background: "#c0392b" }}
                >
                  Delete{" "}
                  <span style={{ color: "#ffaaaa", fontSize: 10 }}>O(n)</span>
                </button>
              </div>
            )}
            {activeTab === "update" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={lbl}>Replace with</span>
                <select
                  value={inputs.updateProduct}
                  onChange={(e) => setInput("updateProduct", e.target.value)}
                  style={sel}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {PRODUCT_EMOJIS[p]} {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onUpdate}
                  disabled={selectedIndex === null}
                  style={{
                    ...btn,
                    background: selectedIndex === null ? "#444" : "#8e44ad",
                    cursor: selectedIndex === null ? "not-allowed" : "pointer",
                  }}
                >
                  Update [{selectedIndex ?? "?"}]{" "}
                  <span style={{ color: "#7fe0a0", fontSize: 10 }}>O(1)</span>
                </button>
              </div>
            )}
            {log.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.1)",
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

          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 16,
              right: 16,
              display: "flex",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={onReset}
              style={{ ...btn, background: "rgba(255,255,255,0.1)", flex: 1 }}
            >
              🔄 Reset
            </button>
            <button
              onClick={onExit}
              style={{ ...btn, background: "rgba(180,30,30,0.78)", flex: 1 }}
            >
              ✕ Exit AR
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const lbl = { color: "rgba(255,255,255,0.6)", fontSize: 13 };
const inp = {
  width: 60,
  padding: "6px 10px",
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  color: "#f39c12",
  fontFamily: "monospace",
  fontSize: 13,
};
const btn = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  fontSize: 13,
  cursor: "pointer",
};
const sel = {
  padding: "6px 10px",
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
};

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

  const [isAR, setIsAR] = useState(false);
  const [placedMatrix, setPlacedMatrix] = useState(null);
  const [hitMatrix, setHitMatrix] = useState(null);
  const [arError, setArError] = useState(null);
  const [arStarting, setArStarting] = useState(false);

  // FIX 7: Store the Three.js WebGLRenderer (not gl context) so XRSessionManager
  // can access both renderer.domElement (for raw GL context) and renderer.xr
  const rendererRef = useRef(null);

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
    addLog(`✅ Access [${idx}] → "${items[idx]}"  ·  O(1)`, "success");
  };
  const handleInsert = () => {
    const idx = +inputs.insertIdx;
    if (idx < 0 || idx > items.length)
      return addLog("⚠️ Index out of bounds!", "error");
    const next = [...items];
    next.splice(idx, 0, inputs.insertProduct);
    setItems(next.slice(0, INITIAL_ITEMS.length));
    setSelectedIndex(idx);
    addLog(
      `➕ Insert "${inputs.insertProduct}" at [${idx}]  ·  Shifted ${items.length - idx} right  ·  O(n)`,
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

  const handleEnterAR = async () => {
    setArError(null);
    setArStarting(true);
    setPlacedMatrix(null);
    setHitMatrix(null);

    xrManager.onHit = (matrix) => setHitMatrix(matrix ? matrix.clone() : null);
    xrManager.onSelect = (matrix) => {
      setPlacedMatrix(matrix.clone());
      xrManager.onSelect = null;
    };
    xrManager.onEnd = () => {
      setIsAR(false);
      setPlacedMatrix(null);
      setHitMatrix(null);
      setArStarting(false);
    };

    try {
      // FIX 8: Pass the renderer (not glRef) to xrManager.start()
      if (!rendererRef.current) throw new Error("Renderer not ready yet.");
      await xrManager.start(rendererRef.current);
      setIsAR(true);
    } catch (err) {
      setArError(err.message);
    } finally {
      setArStarting(false);
    }
  };

  const handleExitAR = () => xrManager.end();

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
      {/* AROverlay always in DOM — visibility controlled by CSS inside */}
      <AROverlay
        isAR={isAR}
        placedMatrix={placedMatrix}
        hasHit={!!hitMatrix}
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
        onExit={handleExitAR}
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

      {/* AR error */}
      {arError && (
        <div
          style={{
            background: "rgba(180,30,30,0.15)",
            border: "1px solid rgba(200,50,50,0.35)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div>
            <div
              style={{
                color: "#ff8080",
                fontWeight: "bold",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              AR could not start
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              {arError}
            </div>
          </div>
        </div>
      )}

      {/* Enter AR button */}
      {!isAR && (
        <div className="flex justify-end">
          <button
            onClick={handleEnterAR}
            disabled={arStarting}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              background: arStarting
                ? "rgba(255,255,255,0.1)"
                : "linear-gradient(135deg,#f39c12,#e67e22)",
              color: arStarting ? "rgba(255,255,255,0.4)" : "#fff",
              fontWeight: "bold",
              fontSize: 14,
              cursor: arStarting ? "not-allowed" : "pointer",
              boxShadow: arStarting ? "none" : "0 0 20px rgba(243,156,18,0.35)",
              fontFamily: "monospace",
            }}
          >
            {arStarting ? "⏳ Requesting camera..." : "📱 Enter AR Mode"}
          </button>
        </div>
      )}

      {/* 3D Canvas — always mounted so WebXR can reuse its gl context */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]"
        style={{
          height: 420,
          background:
            "linear-gradient(180deg,#0d1b2a 0%,#1a2f4e 60%,#0a1628 100%)",
          display: isAR ? "none" : "block",
        }}
      >
        <Canvas
          camera={{ position: [0, 1.5, 7.5], fov: 42 }}
          shadows
          gl={{ alpha: true, antialias: true, xrCompatible: true }}
          onCreated={({ gl }) => {
            // FIX 9: Store the Three.js WebGLRenderer (gl IS the renderer in R3F)
            rendererRef.current = gl;
          }}
        >
          <ShelfScene
            items={items}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            isAR={isAR}
            placedMatrix={placedMatrix}
            hitMatrix={hitMatrix}
          />
        </Canvas>
      </div>

      {/* Normal 3D mode UI */}
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
                    Insert at index, shifts right —{" "}
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
                    Remove at index, shifts left —{" "}
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
