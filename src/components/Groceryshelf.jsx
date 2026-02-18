import { useRef, useState, useEffect, useCallback } from "react";
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

// ─── Reticle mesh ─────────────────────────────────────────────────────────────
function Reticle({ reticleRef }) {
  return (
    <group ref={reticleRef} visible={false} matrixAutoUpdate={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 36]} />
        <meshBasicMaterial
          color="#f39c12"
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.17, 0.19, 36]} />
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
          color="#ffffff"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── THE FIX: WebXR session starter — lives INSIDE Canvas so it has R3F gl access
//
//  The Immersive Web sample works because it owns its own WebGL context from the start.
//  In R3F, the renderer already owns the canvas/context — so we MUST go through
//  renderer.xr (Three.js's built-in WebXRManager) instead of creating a new XRWebGLLayer.
//
//  renderer.xr.setSession(session) is the correct bridge:
//    • Three.js handles XRWebGLLayer creation internally
//    • R3F's useFrame loop automatically becomes the XR frame loop
//    • No context conflict, no separate RAF loop
//
function ARSessionManager({
  onSessionReady,
  onSessionEnd,
  reticleRef,
  onHitResult,
  onNoHit,
}) {
  const { gl } = useThree(); // gl = THREE.WebGLRenderer — already owns the canvas

  useEffect(() => {
    let hitTestSource = null;
    let localRefSpace = null;
    let viewerRefSpace = null;
    let session = null;

    async function startAR() {
      try {
        // Step 1: request session — same requiredFeatures as Immersive Web sample
        session = await navigator.xr.requestSession("immersive-ar", {
          requiredFeatures: ["local", "hit-test"],
          optionalFeatures: ["dom-overlay"],
          domOverlay: { root: document.getElementById("ar-overlay") },
        });

        // Step 2: THE KEY FIX
        // Instead of: new XRWebGLLayer(session, gl.getContext()) ← conflict
        // We do:      renderer.xr.setSession(session)           ← R3F-native
        // Three.js handles the baseLayer internally, R3F frame loop becomes XR loop
        await gl.xr.setSession(session);
        gl.xr.enabled = true;

        // Step 3: reference spaces — same as Immersive Web sample
        viewerRefSpace = await session.requestReferenceSpace("viewer");
        localRefSpace = await session.requestReferenceSpace("local");

        // Step 4: hit-test source from viewer space (ray from camera center)
        hitTestSource = await session.requestHitTestSource({
          space: viewerRefSpace,
        });

        session.addEventListener("end", () => {
          hitTestSource = null;
          localRefSpace = null;
          hitTestSource = null;
          gl.xr.enabled = false;
          onSessionEnd();
        });

        // Expose to parent via callback
        onSessionReady({
          getHitResults: (frame) => {
            if (!hitTestSource || !localRefSpace) return [];
            return {
              hits: frame.getHitTestResults(hitTestSource),
              refSpace: localRefSpace,
            };
          },
          endSession: () => session.end(),
        });
      } catch (err) {
        console.error("WebXR session error:", err);
        // Detailed error so we know WHAT actually failed
        onSessionEnd({ error: err.message || err.name || String(err) });
      }
    }

    startAR();

    return () => {
      if (session) {
        try {
          session.end();
        } catch (_) {}
      }
    };
  }, []);

  // R3F's useFrame IS the XR frame loop once renderer.xr.setSession() is called
  // This mirrors onXRFrame() from the Immersive Web sample
  useFrame((state, delta, xrFrame) => {
    if (!xrFrame || !reticleRef.current) return;

    // xrFrame = the live XRFrame — same as the `frame` arg in sample's onXRFrame
    const sessionAPI = state.gl.xr;
    if (!sessionAPI?.isPresenting) return;

    // Get hit test results for this frame
    const result = onHitResult(xrFrame);
    if (!result) return;

    const { hits, refSpace } = result;

    if (hits && hits.length > 0) {
      const hitPose = hits[0].getPose(refSpace);
      if (hitPose) {
        // Apply hit pose matrix to reticle — identical to sample:
        // reticle.visible = true; reticle.matrix = pose.transform.matrix;
        reticleRef.current.visible = true;
        reticleRef.current.matrix.fromArray(hitPose.transform.matrix);
        reticleRef.current.matrix.decompose(
          reticleRef.current.position,
          reticleRef.current.quaternion,
          reticleRef.current.scale,
        );
        onNoHit(false, hitPose.transform.matrix);
      }
    } else {
      reticleRef.current.visible = false;
      onNoHit(true, null);
    }
  });

  return null; // no visual output — just manages session lifecycle
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

// ─── Full scene ───────────────────────────────────────────────────────────────
function ShelfScene({
  items,
  selectedIndex,
  onSelect,
  isAR,
  startAR,
  arActive,
  placedMatrix,
  reticleRef,
  onSessionReady,
  onSessionEnd,
  onHitResult,
  onNoHit,
}) {
  const ITEM_W = 0.95;
  const ROW = Math.ceil(items.length / 2);
  const SHELF_Y = [-0.3, 1.15];
  const row0 = items.slice(0, ROW);
  const row1 = items.slice(ROW);
  const shelfRef = useRef();
  const AR_SCALE = 0.28;

  // Apply world-pose matrix to shelf on placement
  useEffect(() => {
    if (!placedMatrix || !shelfRef.current) return;
    const m = new THREE.Matrix4().fromArray(placedMatrix);
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

      {/* AR session manager — mounted inside Canvas, uses R3F's gl.xr */}
      {startAR && (
        <ARSessionManager
          onSessionReady={onSessionReady}
          onSessionEnd={onSessionEnd}
          reticleRef={reticleRef}
          onHitResult={onHitResult}
          onNoHit={onNoHit}
        />
      )}

      {/* Reticle — shown in AR scanning phase */}
      {isAR && <Reticle reticleRef={reticleRef} />}

      {/* Shelf */}
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
  arError,
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
      {/* Error state */}
      {arError && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "rgba(0,0,0,0.9)",
            border: "1px solid rgba(231,76,60,0.5)",
            borderRadius: 16,
            padding: "20px 24px",
            textAlign: "center",
            maxWidth: 300,
            pointerEvents: "auto",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div
            style={{
              color: "#e74c3c",
              fontWeight: "bold",
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            AR Session Failed
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              marginBottom: 16,
              wordBreak: "break-word",
            }}
          >
            {arError}
          </div>
          <button
            onClick={onExit}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "8px 20px",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Scanning phase */}
      {!placed && !arError && (
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
          <div
            style={{
              background: "rgba(0,0,0,0.75)",
              border: `1px solid ${reticleVisible ? "rgba(46,204,113,0.5)" : "rgba(243,156,18,0.4)"}`,
              borderRadius: 14,
              padding: "11px 24px",
              textAlign: "center",
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
                ? "Tap the button below to place the shelf"
                : "Point camera at a table or floor and move slowly"}
            </div>
          </div>

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

      {/* Placed: operation HUD */}
      {placed && !arError && (
        <>
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
              {selectedIndex !== null ? ` · [${selectedIndex}]` : ""}
            </span>
          </div>

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
                <HudNum
                  value={inputs.accessIdx}
                  max={items.length - 1}
                  onChange={(v) => setInput("accessIdx", v)}
                />
                <HudBtn color="#2980b9" onClick={onAccess}>
                  Access <Bdg green>O(1)</Bdg>
                </HudBtn>
              </HudRow>
            )}
            {activeTab === "insert" && (
              <HudRow wrap>
                <HudLabel>Index</HudLabel>
                <HudNum
                  value={inputs.insertIdx}
                  max={items.length}
                  onChange={(v) => setInput("insertIdx", v)}
                />
                <HudSel
                  value={inputs.insertProduct}
                  onChange={(v) => setInput("insertProduct", v)}
                />
                <HudBtn color="#27ae60" onClick={onInsert}>
                  Insert <Bdg>O(n)</Bdg>
                </HudBtn>
              </HudRow>
            )}
            {activeTab === "delete" && (
              <HudRow>
                <HudLabel>Index</HudLabel>
                <HudNum
                  value={inputs.deleteIdx}
                  max={items.length - 1}
                  onChange={(v) => setInput("deleteIdx", v)}
                />
                <HudBtn color="#c0392b" onClick={onDelete}>
                  Delete <Bdg>O(n)</Bdg>
                </HudBtn>
              </HudRow>
            )}
            {activeTab === "update" && (
              <HudRow wrap>
                <HudLabel>Replace with</HudLabel>
                <HudSel
                  value={inputs.updateProduct}
                  onChange={(v) => setInput("updateProduct", v)}
                />
                <HudBtn
                  color={selectedIndex === null ? "#555" : "#8e44ad"}
                  disabled={selectedIndex === null}
                  onClick={onUpdate}
                >
                  Update [{selectedIndex ?? "?"}] <Bdg green>O(1)</Bdg>
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
              left: 14,
              right: 14,
              display: "flex",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={onReset}
              style={{ ...B, background: "rgba(255,255,255,0.12)", flex: 1 }}
            >
              🔄 Reset
            </button>
            <button
              onClick={onExit}
              style={{ ...B, background: "rgba(180,30,30,0.78)", flex: 1 }}
            >
              ✕ Exit AR
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Micro UI atoms ──
const B = {
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
const Bdg = ({ children, green }) => (
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
      ...B,
      background: color,
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    {children}
  </button>
);
const HudNum = ({ value, onChange, max }) => (
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
const HudSel = ({ value, onChange }) => (
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
  const [arSupported, setArSupported] = useState(null);
  const [startAR, setStartAR] = useState(false); // mounts ARSessionManager inside Canvas
  const [isAR, setIsAR] = useState(false); // true = session active
  const [reticleVisible, setReticleVisible] = useState(false);
  const [placedMatrix, setPlacedMatrix] = useState(null);
  const [arError, setArError] = useState(null);

  const reticleRef = useRef();
  const latestHitRef = useRef(null);
  const sessionApiRef = useRef(null); // { endSession, getHitResults }

  useEffect(() => {
    if (!navigator.xr) {
      setArSupported(false);
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then(setArSupported)
      .catch(() => setArSupported(false));
  }, []);

  // Called by ARSessionManager once session + hit-test source are ready
  const handleSessionReady = useCallback((api) => {
    sessionApiRef.current = api;
    setIsAR(true);
    setArError(null);
  }, []);

  // Called by ARSessionManager on session end or error
  const handleSessionEnd = useCallback(({ error } = {}) => {
    setIsAR(false);
    setStartAR(false);
    setPlacedMatrix(null);
    setReticleVisible(false);
    if (error) setArError(error);
  }, []);

  // Called every XR frame from ARSessionManager's useFrame
  // Returns hit results to the frame loop (avoids stale closure issues)
  const handleHitResult = useCallback((xrFrame) => {
    if (!sessionApiRef.current) return null;
    return sessionApiRef.current.getHitResults(xrFrame);
  }, []);

  // Called every frame with reticle visibility + latest hit matrix
  const handleNoHit = useCallback((noHit, matrix) => {
    setReticleVisible(!noHit);
    latestHitRef.current = noHit ? null : matrix;
  }, []);

  // ONE-TIME placement — read latestHitRef synchronously
  const handlePlace = useCallback(() => {
    if (!latestHitRef.current) return;
    setPlacedMatrix(new Float32Array(latestHitRef.current));
    if (reticleRef.current) reticleRef.current.visible = false;
    setReticleVisible(false);
  }, []);

  const handleEnterAR = useCallback(() => {
    setArError(null);
    setPlacedMatrix(null);
    setReticleVisible(false);
    setStartAR(true); // mounts <ARSessionManager> inside Canvas → starts session
  }, []);

  const handleExitAR = useCallback(() => {
    if (sessionApiRef.current) sessionApiRef.current.endSession();
    sessionApiRef.current = null;
    setIsAR(false);
    setStartAR(false);
    setPlacedMatrix(null);
    setReticleVisible(false);
    setArError(null);
  }, []);

  const addLog = (msg, type = "info") =>
    setLog((p) => [{ msg, type, id: Date.now() }, ...p].slice(0, 8));
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
    const next = [...items];
    next.splice(idx, 0, inputs.insertProduct);
    setItems(next.slice(0, INITIAL_ITEMS.length));
    setSelectedIndex(idx);
    addLog(
      `➕ Insert "${inputs.insertProduct}" at [${idx}]  ·  Shifted ${items.length - idx}  ·  O(n)`,
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
    const next = [...items];
    next[selectedIndex] = inputs.updateProduct;
    setItems(next);
    addLog(
      `✏️ Update [${selectedIndex}] "${items[selectedIndex]}" → "${inputs.updateProduct}"  ·  O(1)`,
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
        arError={arError}
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

      {arSupported === false && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-900/20 border border-red-500/30 rounded-xl text-sm">
          <span className="text-xl">📵</span>
          <div>
            <div className="text-red-400 font-bold">AR Not Supported</div>
            <div className="text-white/40 text-xs">
              Android Chrome 81+ required. iOS Safari blocks WebXR AR.
            </div>
          </div>
        </div>
      )}

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

      {/* Canvas always mounted — WebXR takes it over when session starts */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]"
        style={{
          height: 420,
          background:
            "linear-gradient(180deg,#0d1b2a 0%,#1a2f4e 60%,#0a1628 100%)",
          // Keep visible always — WebXR uses this canvas when AR is active
        }}
      >
        <Canvas
          camera={{ position: [0, 1.5, 7.5], fov: 42 }}
          shadows
          gl={{ alpha: true, antialias: true }} // alpha:true needed for transparent AR bg
        >
          <ShelfScene
            items={items}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            isAR={isAR}
            startAR={startAR}
            placedMatrix={placedMatrix}
            reticleRef={reticleRef}
            onSessionReady={handleSessionReady}
            onSessionEnd={handleSessionEnd}
            onHitResult={handleHitResult}
            onNoHit={handleNoHit}
          />
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
            💡 Click boxes to select · Drag to rotate · Scroll to zoom
          </p>
        </>
      )}
    </div>
  );
}
