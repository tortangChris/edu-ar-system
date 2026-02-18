import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Text,
  RoundedBox,
  OrbitControls,
  Environment,
} from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import { gsap } from "gsap";
import * as THREE from "three";

// ─── XR Store ─────────────────────────────────────────────────────────────────
const xrStore = createXRStore();

// ─── Placement states ─────────────────────────────────────────────────────────
const PS = {
  SCANNING: "scanning",
  PREVIEWING: "previewing",
  CONFIRMED: "confirmed",
};

// ─── Product data ─────────────────────────────────────────────────────────────
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

// ─── useARSupport ─────────────────────────────────────────────────────────────
function useARSupport() {
  const [supported, setSupported] = useState(null);
  useEffect(() => {
    if (!navigator.xr) {
      setSupported(false);
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);
  return supported;
}

// ─── AR Core: hit-test + select listener ─────────────────────────────────────
// Lives inside <XR> so gl.xr is available.
// Key fix: hitPosRef is a ref (not state), so the `select` handler always
// reads the LATEST hit position without any stale closure problem.
function ARCore({
  active,
  hitPosRef,
  onHitPos,
  onNoHit,
  onTap,
  setPlaceState,
  setAnchorPos,
}) {
  const { gl } = useThree();

  const hitTestSourceRef = useRef(null);
  const localSpaceRef = useRef(null);

  // Set up hit-test source once when active
  useEffect(() => {
    if (!active) return;

    const session = gl.xr?.getSession?.();
    if (!session) return;

    let cancelled = false;

    session
      .requestReferenceSpace("local")
      .then((localSpace) => {
        if (cancelled) return;
        localSpaceRef.current = localSpace;

        session
          .requestReferenceSpace("viewer")
          .then((viewerSpace) => {
            if (cancelled) return;

            session
              .requestHitTestSource({ space: viewerSpace })
              .then((source) => {
                if (cancelled) {
                  try {
                    source.cancel();
                  } catch (_) {}
                  return;
                }
                hitTestSourceRef.current = source;
              })
              .catch(console.warn);
          })
          .catch(console.warn);
      })
      .catch(console.warn);

    // select = screen tap (or controller trigger)
    // Reading hitPosRef.current here is ALWAYS fresh — no stale closure
    const handleSelect = () => {
      const pos = hitPosRef.current;
      if (!pos) return;
      setAnchorPos(pos.clone());
      setPlaceState(PS.PREVIEWING);
    };

    session.addEventListener("select", handleSelect);

    return () => {
      cancelled = true;
      session.removeEventListener("select", handleSelect);
      if (hitTestSourceRef.current) {
        try {
          hitTestSourceRef.current.cancel();
        } catch (_) {}
        hitTestSourceRef.current = null;
      }
      localSpaceRef.current = null;
    };
  }, [active, gl]); // stable refs — no re-render deps needed

  // Every frame: poll hit-test results and update the ref + visual
  useFrame((_, __, frame) => {
    if (!active || !frame) return;
    const source = hitTestSourceRef.current;
    const refSpace = localSpaceRef.current;
    if (!source || !refSpace) return;

    const results = frame.getHitTestResults(source);
    if (results.length > 0) {
      const pose = results[0].getPose(refSpace);
      if (pose) {
        onHitPos(pose.transform.matrix); // pass raw matrix to reticle
        return;
      }
    }
    onNoHit();
  });

  return null;
}

// ─── AR Reticle (pure visual, receives matrix from ARCore) ────────────────────
function ARReticle({ matrixRef }) {
  const reticleRef = useRef();
  const pulseRef = useRef();
  const mat4 = useRef(new THREE.Matrix4());

  // Apply the latest hit matrix every frame
  useFrame(({ clock }) => {
    const m = matrixRef.current;
    if (reticleRef.current) {
      if (m) {
        reticleRef.current.visible = true;
        mat4.current.fromArray(m);
        mat4.current.decompose(
          reticleRef.current.position,
          reticleRef.current.quaternion,
          reticleRef.current.scale,
        );
      } else {
        reticleRef.current.visible = false;
      }
    }

    // Pulse animation
    if (pulseRef.current) {
      const t = clock.elapsedTime;
      const s = 1 + 0.18 * Math.sin(t * 3.5);
      pulseRef.current.scale.set(s, s, 1);
      pulseRef.current.material.opacity = 0.2 + 0.12 * Math.sin(t * 3.5);
    }
  });

  return (
    <group ref={reticleRef} visible={false}>
      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 36]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Inner dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.04, 20]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Pulse ring */}
      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.19, 36]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── GroceryBox ───────────────────────────────────────────────────────────────
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

  useFrame(({ clock }) => {
    if (!boxRef.current) return;
    boxRef.current.rotation.y = isSelected
      ? Math.sin(clock.elapsedTime * 2) * 0.15
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

// ─── ShelfScene ───────────────────────────────────────────────────────────────
function ShelfScene({
  items,
  selectedIndex,
  onSelect,
  isAR,
  placeState,
  anchorPos,
  hitPosRef,
  hitMatrixRef,
  setPlaceState,
  setAnchorPos,
}) {
  const ITEM_W = 0.95;
  const ROW = Math.ceil(items.length / 2);
  const SHELF_Y = [-0.3, 1.15];
  const AR_SCALE = 0.28;

  const shelfProps =
    isAR && anchorPos
      ? {
          position: [anchorPos.x, anchorPos.y, anchorPos.z],
          scale: [AR_SCALE, AR_SCALE, AR_SCALE],
        }
      : { position: [0, -0.6, 0], scale: [1, 1, 1] };

  const showShelf =
    !isAR || placeState === PS.PREVIEWING || placeState === PS.CONFIRMED;

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

  // Update hitPosRef from the raw matrix so select handler can always read it
  const handleHitPos = useCallback((matrix) => {
    hitMatrixRef.current = matrix;
    // Decode position from matrix for the ref
    const m = new THREE.Matrix4().fromArray(matrix);
    const pos = new THREE.Vector3();
    m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    hitPosRef.current = pos;
  }, []);

  const handleNoHit = useCallback(() => {
    hitMatrixRef.current = null;
    hitPosRef.current = null;
  }, []);

  return (
    <>
      <ambientLight intensity={isAR ? 1.0 : 0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={isAR ? 0.8 : 1.2}
        castShadow
      />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.4}
        color="#b0c4de"
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#fff5e0" />

      {/* AR Core: hit-test setup + select listener, only while scanning */}
      {isAR && (
        <ARCore
          active={placeState === PS.SCANNING}
          hitPosRef={hitPosRef}
          onHitPos={handleHitPos}
          onNoHit={handleNoHit}
          setPlaceState={setPlaceState}
          setAnchorPos={setAnchorPos}
        />
      )}

      {/* Reticle reads from hitMatrixRef — only while scanning */}
      {isAR && placeState === PS.SCANNING && (
        <ARReticle matrixRef={hitMatrixRef} />
      )}

      {/* Shelf */}
      {showShelf && (
        <group {...shelfProps}>
          <ShelfFrame height={2.4} width={ROW * ITEM_W} />
          <ShelfBoard y={SHELF_Y[0]} width={ROW * ITEM_W} />
          <ShelfBoard y={SHELF_Y[1]} width={ROW * ITEM_W} />
          {renderRow(items.slice(0, ROW), 0, SHELF_Y[0])}
          {renderRow(items.slice(ROW), ROW, SHELF_Y[1])}
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

// ─── AR HUD ───────────────────────────────────────────────────────────────────
function ARHud({
  isAR,
  placeState,
  hasHit,
  onConfirm,
  onReplace,
  onExit,
  items,
  selectedIndex,
  activeTab,
  inputs,
  onAccess,
  onInsert,
  onDelete,
  onUpdate,
  onReset,
  setInput,
  setActiveTab,
  log,
}) {
  if (!isAR) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        fontFamily: "'Courier New',monospace",
      }}
    >
      {/* SCANNING */}
      {placeState === PS.SCANNING && (
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(243,156,18,0.5)",
              borderRadius: 16,
              padding: "12px 24px",
              color: "#f39c12",
              fontSize: 14,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            🎯 Point at a flat surface
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: "normal",
                marginTop: 4,
              }}
            >
              {hasHit
                ? "✨ Surface found — tap the screen to place!"
                : "Move your phone slowly until the ring appears"}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEWING */}
      {placeState === PS.PREVIEWING && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(243,156,18,0.4)",
              borderRadius: 14,
              padding: "12px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#f39c12",
                fontWeight: "bold",
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              📐 Shelf Preview
            </div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
              Happy with the position? Confirm to lock it in.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={onReplace}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: "2px solid rgba(255,255,255,0.25)",
                background: "rgba(0,0,0,0.75)",
                color: "#fff",
                fontWeight: "bold",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              🔄 Re-place
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#f39c12,#e67e22)",
                color: "#1a1a1a",
                fontWeight: "bold",
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(243,156,18,0.5)",
              }}
            >
              ✅ Confirm
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMED */}
      {placeState === PS.CONFIRMED && (
        <>
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              background: "rgba(0,0,0,0.7)",
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
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
              Array[{items.length}]
              {selectedIndex !== null
                ? ` · [${selectedIndex}]="${items[selectedIndex]}"`
                : ""}
            </span>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 200,
              left: 16,
              right: 16,
              display: "flex",
              gap: 8,
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
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: "bold",
                  border: "2px solid",
                  cursor: "pointer",
                  background: activeTab === tab ? "#f39c12" : "rgba(0,0,0,0.7)",
                  borderColor:
                    activeTab === tab ? "#f39c12" : "rgba(255,255,255,0.2)",
                  color:
                    activeTab === tab ? "#1a1a1a" : "rgba(255,255,255,0.7)",
                }}
              >
                {emoji} {label}
              </button>
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: 16,
              right: 16,
              background: "rgba(0,0,0,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: "14px 16px",
              pointerEvents: "auto",
            }}
          >
            {activeTab === "access" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={labelS}>Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length - 1}
                  value={inputs.accessIdx}
                  onChange={(e) => setInput("accessIdx", e.target.value)}
                  style={inpS}
                />
                <button
                  onClick={onAccess}
                  style={{ ...btnS, background: "#2980b9" }}
                >
                  Access <small style={{ color: "#7fe0a0" }}>O(1)</small>
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
                <span style={labelS}>Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length}
                  value={inputs.insertIdx}
                  onChange={(e) => setInput("insertIdx", e.target.value)}
                  style={inpS}
                />
                <select
                  value={inputs.insertProduct}
                  onChange={(e) => setInput("insertProduct", e.target.value)}
                  style={selS}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {PRODUCT_EMOJIS[p]} {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onInsert}
                  style={{ ...btnS, background: "#27ae60" }}
                >
                  Insert <small style={{ color: "#ff9e9e" }}>O(n)</small>
                </button>
              </div>
            )}
            {activeTab === "delete" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={labelS}>Index</span>
                <input
                  type="number"
                  min={0}
                  max={items.length - 1}
                  value={inputs.deleteIdx}
                  onChange={(e) => setInput("deleteIdx", e.target.value)}
                  style={inpS}
                />
                <button
                  onClick={onDelete}
                  style={{ ...btnS, background: "#c0392b" }}
                >
                  Delete <small style={{ color: "#ff9e9e" }}>O(n)</small>
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
                <span style={labelS}>Replace with</span>
                <select
                  value={inputs.updateProduct}
                  onChange={(e) => setInput("updateProduct", e.target.value)}
                  style={selS}
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
                    ...btnS,
                    background: selectedIndex === null ? "#555" : "#8e44ad",
                    cursor: selectedIndex === null ? "not-allowed" : "pointer",
                  }}
                >
                  Update [{selectedIndex ?? "?"}]{" "}
                  <small style={{ color: "#7fe0a0" }}>O(1)</small>
                </button>
              </div>
            )}
            {log.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color:
                    log[0].type === "success"
                      ? "#7fe0a0"
                      : log[0].type === "error"
                        ? "#ff8080"
                        : "#f39c12",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: 8,
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
              style={{ ...btnS, background: "rgba(255,255,255,0.1)", flex: 1 }}
            >
              🔄 Reset
            </button>
            <button
              onClick={onExit}
              style={{ ...btnS, background: "rgba(180,30,30,0.7)", flex: 1 }}
            >
              ✕ Exit AR
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const labelS = { color: "rgba(255,255,255,0.6)", fontSize: 13 };
const inpS = {
  width: 60,
  padding: "6px 10px",
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  color: "#f39c12",
  fontFamily: "monospace",
  fontSize: 13,
};
const btnS = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  fontSize: 13,
  cursor: "pointer",
};
const selS = {
  padding: "6px 10px",
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
};

function ARUnsupportedBanner() {
  return (
    <div
      style={{
        background: "rgba(180,30,30,0.15)",
        border: "1px solid rgba(200,50,50,0.3)",
        borderRadius: 12,
        padding: "10px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 20 }}>📵</span>
      <div>
        <div style={{ color: "#ff8080", fontWeight: "bold", fontSize: 13 }}>
          AR Not Supported
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
          Use Android Chrome 81+. iOS Safari not supported.
        </div>
      </div>
    </div>
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

  const [isAR, setIsAR] = useState(false);
  const [placeState, setPlaceState] = useState(PS.SCANNING);
  const [anchorPos, setAnchorPos] = useState(null); // locked THREE.Vector3

  // ─── THE KEY FIX: store live hit data in REFS, not state ──────────────────
  // Refs are always fresh inside event handlers — no stale closure ever.
  const hitPosRef = useRef(null); // THREE.Vector3, latest reticle world pos
  const hitMatrixRef = useRef(null); // Float32Array 4x4, for reticle rendering

  // hasHit drives the HUD label only — OK to be a state derived from renders
  const [hasHit, setHasHit] = useState(false);

  const arSupported = useARSupport();

  const addLog = (msg, type = "info") =>
    setLog((p) => [{ msg, type, id: Date.now() }, ...p].slice(0, 8));
  const setInput = (k, v) => setInputs((p) => ({ ...p, [k]: v }));

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

  const handleEnterAR = useCallback(async () => {
    setPlaceState(PS.SCANNING);
    setAnchorPos(null);
    hitPosRef.current = null;
    hitMatrixRef.current = null;
    setHasHit(false);
    await xrStore.enterAR({ requiredFeatures: ["local", "hit-test"] });
    setIsAR(true);
  }, []);

  const handleExitAR = useCallback(() => {
    try {
      xrStore.getState()?.session?.end();
    } catch (_) {}
    setIsAR(false);
    setPlaceState(PS.SCANNING);
    setAnchorPos(null);
    hitPosRef.current = null;
    hitMatrixRef.current = null;
    setHasHit(false);
  }, []);

  // Called from ShelfScene/ARCore when hit-test updates — update ref AND hasHit state
  const handleHitUpdate = useCallback((matrix) => {
    hitMatrixRef.current = matrix;
    const m = new THREE.Matrix4().fromArray(matrix);
    const pos = new THREE.Vector3();
    m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    hitPosRef.current = pos;
    setHasHit(true);
  }, []);

  const handleNoHit = useCallback(() => {
    hitMatrixRef.current = null;
    hitPosRef.current = null;
    setHasHit(false);
  }, []);

  const handleConfirm = useCallback(() => setPlaceState(PS.CONFIRMED), []);
  const handleReplace = useCallback(() => {
    setAnchorPos(null);
    hitPosRef.current = null;
    hitMatrixRef.current = null;
    setHasHit(false);
    setPlaceState(PS.SCANNING);
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
      style={{ fontFamily: "'Courier New',monospace" }}
    >
      <ARHud
        isAR={isAR}
        placeState={placeState}
        hasHit={hasHit}
        onConfirm={handleConfirm}
        onReplace={handleReplace}
        onExit={handleExitAR}
        items={items}
        selectedIndex={selectedIndex}
        activeTab={activeTab}
        inputs={inputs}
        onAccess={handleAccess}
        onInsert={handleInsert}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onReset={handleReset}
        setInput={setInput}
        setActiveTab={setActiveTab}
        log={log}
      />

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

      {arSupported === false && <ARUnsupportedBanner />}

      {!isAR && (
        <div className="flex justify-end">
          {arSupported === null && (
            <button
              disabled
              className="px-5 py-2.5 rounded-xl bg-white/10 text-white/40 font-bold text-sm border-none"
            >
              Checking AR…
            </button>
          )}
          {arSupported === true && (
            <button
              onClick={handleEnterAR}
              className="px-5 py-2.5 rounded-xl border-none font-bold text-sm text-white cursor-pointer"
              style={{
                background: "linear-gradient(135deg,#f39c12,#e67e22)",
                boxShadow: "0 0 20px rgba(243,156,18,0.4)",
              }}
            >
              📱 Enter AR Mode
            </button>
          )}
        </div>
      )}

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
          <XR store={xrStore}>
            <ShelfScene
              items={items}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
              isAR={isAR}
              placeState={placeState}
              anchorPos={anchorPos}
              hitPosRef={hitPosRef}
              hitMatrixRef={hitMatrixRef}
              setPlaceState={setPlaceState}
              setAnchorPos={setAnchorPos}
              onHitUpdate={handleHitUpdate}
              onNoHit={handleNoHit}
            />
          </XR>
        </Canvas>
      </div>

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
                      No operations yet…
                    </p>
                  ) : (
                    log.map((e, i) => (
                      <div
                        key={e.id}
                        className={`text-xs font-mono py-1 px-2 rounded border-l-2 ${
                          e.type === "success"
                            ? "border-green-400 bg-green-400/5 text-green-300"
                            : e.type === "error"
                              ? "border-red-400 bg-red-400/5 text-red-300"
                              : e.type === "select"
                                ? "border-amber-400 bg-amber-400/5 text-amber-300"
                                : "border-blue-400 bg-blue-400/5 text-blue-300"
                        } ${i > 0 ? "opacity-50" : ""}`}
                      >
                        {e.msg}
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
            💡 Click boxes on the shelf to select · Drag to rotate · Scroll to
            zoom
          </p>
        </>
      )}
    </div>
  );
}
