import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

// ─── Constants ────────────────────────────────────────────────────────────────
const CAR_SPACING = 1.85;
const CAR_W = 0.9;
const CAR_H = 0.42;
const CAR_L = 1.55;
const LANE_Z = 0;
const ROAD_Y = -0.82;
const MAX_QUEUE = 7;
const GATE_X = -3.8;
const AR_SCALE = 0.13;

const CAR_STYLES = [
  { body: "#e74c3c", roof: "#c0392b", name: "Sedan", plate: "ABC 001" },
  { body: "#3498db", roof: "#2471a3", name: "SUV", plate: "XYZ 002" },
  { body: "#2ecc71", roof: "#1e8449", name: "Hatch", plate: "DEF 003" },
  { body: "#f39c12", roof: "#d68910", name: "Coupe", plate: "GHI 004" },
  { body: "#9b59b6", roof: "#7d3c98", name: "Van", plate: "JKL 005" },
  { body: "#1abc9c", roof: "#148f77", name: "Truck", plate: "MNO 006" },
  { body: "#e67e22", roof: "#ca6f1e", name: "Sports", plate: "PQR 007" },
  { body: "#e91e63", roof: "#c2185b", name: "Mini", plate: "STU 008" },
];

// helper: lighten a hex color
function lightenHex(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 45);
  const g = Math.min(255, ((n >> 8) & 0xff) + 45);
  const b = Math.min(255, (n & 0xff) + 45);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ─── 3D Button ────────────────────────────────────────────────────────────────
function Button3D({
  position,
  label,
  subLabel,
  color,
  textColor = "#fff",
  width = 1.6,
  height = 0.5,
  disabled = false,
  onClick,
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  useFrame(() => {
    if (!meshRef.current) return;
    const ty = pressed ? -0.04 : hovered ? 0.05 : 0;
    meshRef.current.position.y += (ty - meshRef.current.position.y) * 0.2;
  });

  const col = disabled
    ? "#2a2a2a"
    : pressed
      ? lightenHex(lightenHex(color))
      : hovered
        ? lightenHex(color)
        : color;

  return (
    <group position={position}>
      {/* Drop shadow */}
      <mesh position={[0, -0.06, -0.02]}>
        <boxGeometry args={[width, height, 0.07]} />
        <meshStandardMaterial
          color="#000"
          transparent
          opacity={0.3}
          roughness={1}
        />
      </mesh>
      <group ref={meshRef}>
        <RoundedBox
          args={[width, height, 0.14]}
          radius={0.09}
          smoothness={4}
          onPointerEnter={() => {
            if (!disabled) setHovered(true);
          }}
          onPointerLeave={() => {
            setHovered(false);
            setPressed(false);
          }}
          onPointerDown={() => {
            if (!disabled) setPressed(true);
          }}
          onPointerUp={() => {
            if (!disabled && pressed) onClick?.();
            setPressed(false);
          }}
        >
          <meshStandardMaterial
            color={col}
            emissive={hovered && !disabled ? color : "#000"}
            emissiveIntensity={hovered && !disabled ? 0.35 : 0}
            roughness={0.25}
            metalness={0.1}
            transparent
            opacity={disabled ? 0.3 : 1}
          />
        </RoundedBox>
        <Text
          position={[0, subLabel ? 0.08 : 0, 0.08]}
          fontSize={0.155}
          color={disabled ? "#555" : textColor}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
        {subLabel && (
          <Text
            position={[0, -0.11, 0.08]}
            fontSize={0.09}
            color={disabled ? "#444" : "rgba(255,255,255,0.55)"}
            anchorX="center"
            anchorY="middle"
          >
            {subLabel}
          </Text>
        )}
      </group>
    </group>
  );
}

// ─── 3D Car Selector Chip ─────────────────────────────────────────────────────
function CarChip({ position, style, isSelected, onClick }) {
  const ref = useRef();
  const [hov, setHov] = useState(false);
  useFrame(() => {
    if (!ref.current) return;
    const s = isSelected ? 1.1 : hov ? 1.05 : 1;
    ref.current.scale.lerp(new THREE.Vector3(s, s, s), 0.15);
  });
  return (
    <group ref={ref} position={position}>
      <RoundedBox
        args={[0.92, 0.38, 0.1]}
        radius={0.06}
        smoothness={4}
        onPointerEnter={() => setHov(true)}
        onPointerLeave={() => setHov(false)}
        onPointerUp={() => onClick?.()}
      >
        <meshStandardMaterial
          color={isSelected ? style.body : "#16213e"}
          emissive={isSelected ? style.body : "#000"}
          emissiveIntensity={isSelected ? 0.35 : 0}
          roughness={0.3}
          metalness={0.15}
        />
      </RoundedBox>
      <Text
        position={[0, 0.06, 0.06]}
        fontSize={0.105}
        color={isSelected ? "#fff" : "#888"}
        anchorX="center"
        anchorY="middle"
      >
        🚗 {style.name}
      </Text>
      <Text
        position={[0, -0.09, 0.06]}
        fontSize={0.072}
        color={isSelected ? "#fffa" : "#444"}
        anchorX="center"
        anchorY="middle"
      >
        {style.plate}
      </Text>
    </group>
  );
}

// ─── 3D Status Panel ─────────────────────────────────────────────────────────
function StatusPanel({
  position,
  queue,
  isGateOpen,
  frontCar,
  rearCar,
  lastLog,
  autoMode,
}) {
  return (
    <group position={position}>
      <RoundedBox args={[5.4, 1.85, 0.09]} radius={0.11} smoothness={4}>
        <meshStandardMaterial
          color="#04091a"
          transparent
          opacity={0.9}
          roughness={0.5}
          metalness={0.05}
        />
      </RoundedBox>
      {/* border */}
      <RoundedBox
        args={[5.42, 1.87, 0.07]}
        radius={0.11}
        smoothness={4}
        position={[0, 0, -0.01]}
      >
        <meshStandardMaterial
          color="#163358"
          transparent
          opacity={0.55}
          roughness={1}
        />
      </RoundedBox>

      <Text
        position={[-2.0, 0.72, 0.06]}
        fontSize={0.195}
        color="#fbbf24"
        anchorX="left"
        anchorY="middle"
      >
        🚗 CAR TOLL GATE — AR MODE
      </Text>
      {autoMode && (
        <Text
          position={[1.8, 0.72, 0.06]}
          fontSize={0.13}
          color="#fbbf24"
          anchorX="left"
          anchorY="middle"
        >
          ● AUTO
        </Text>
      )}

      <Text
        position={[-2.0, 0.38, 0.06]}
        fontSize={0.125}
        color="#94a3b8"
        anchorX="left"
        anchorY="middle"
      >
        {`Queue: ${queue.length}/${MAX_QUEUE}  ·  Gate: ${isGateOpen ? "🟢 OPEN" : "🔴 CLOSED"}`}
      </Text>
      <Text
        position={[-2.0, 0.1, 0.06]}
        fontSize={0.115}
        color="#4ade80"
        anchorX="left"
        anchorY="middle"
      >
        {frontCar
          ? `FRONT [0]: ${CAR_STYLES[frontCar.styleIdx].name}  (${CAR_STYLES[frontCar.styleIdx].plate})`
          : "FRONT: empty"}
      </Text>
      <Text
        position={[-2.0, -0.14, 0.06]}
        fontSize={0.115}
        color="#f87171"
        anchorX="left"
        anchorY="middle"
      >
        {rearCar && queue.length > 1
          ? `REAR  [${queue.length - 1}]: ${CAR_STYLES[rearCar.styleIdx].name}`
          : queue.length === 1 && frontCar
            ? "REAR = FRONT"
            : "REAR: empty"}
      </Text>

      {/* progress bar bg */}
      <mesh position={[0, -0.44, 0.05]}>
        <boxGeometry args={[4.6, 0.1, 0.01]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* progress fill */}
      {queue.length > 0 && (
        <mesh position={[-2.3 + (queue.length / MAX_QUEUE) * 2.3, -0.44, 0.06]}>
          <boxGeometry args={[(queue.length / MAX_QUEUE) * 4.6, 0.1, 0.01]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {lastLog && (
        <Text
          position={[-2.0, -0.68, 0.06]}
          fontSize={0.105}
          color={
            lastLog.type === "success"
              ? "#4ade80"
              : lastLog.type === "error"
                ? "#f87171"
                : "#60a5fa"
          }
          anchorX="left"
          anchorY="middle"
          maxWidth={5}
        >
          {lastLog.msg}
        </Text>
      )}
    </group>
  );
}

// ─── 3D Control Panel ─────────────────────────────────────────────────────────
function ControlPanel({
  position,
  queue,
  isAnimating,
  autoMode,
  enqueueStyleIdx,
  onEnqueue,
  onDequeue,
  onPeek,
  onToggleAuto,
  onReset,
  onSelectStyle,
  frontCar,
}) {
  return (
    <group position={position}>
      {/* bg panel */}
      <RoundedBox
        args={[8.2, 4.4, 0.08]}
        radius={0.13}
        smoothness={4}
        position={[0, 0, -0.05]}
      >
        <meshStandardMaterial
          color="#03070f"
          transparent
          opacity={0.92}
          roughness={0.5}
        />
      </RoundedBox>
      <RoundedBox
        args={[8.22, 4.42, 0.065]}
        radius={0.13}
        smoothness={4}
        position={[0, 0, -0.06]}
      >
        <meshStandardMaterial
          color="#0d2340"
          transparent
          opacity={0.6}
          roughness={1}
        />
      </RoundedBox>

      {/* section label */}
      <Text
        position={[-3.7, 1.85, 0]}
        fontSize={0.12}
        color="#475569"
        anchorX="left"
        anchorY="middle"
      >
        ── QUEUE OPERATIONS ─────────────────────
      </Text>

      {/* Main action buttons */}
      <Button3D
        position={[-2.7, 1.38, 0]}
        label="🚗  ENQUEUE"
        subLabel={`→ ${CAR_STYLES[enqueueStyleIdx].name} joins REAR  O(1)`}
        color="#1d4ed8"
        width={2.5}
        height={0.58}
        disabled={isAnimating || queue.length >= MAX_QUEUE}
        onClick={onEnqueue}
      />
      <Button3D
        position={[0.3, 1.38, 0]}
        label="✅  DEQUEUE"
        subLabel="← removes FRONT car  O(1)"
        color="#15803d"
        width={2.5}
        height={0.58}
        disabled={isAnimating || queue.length === 0}
        onClick={onDequeue}
      />
      <Button3D
        position={[3.1, 1.38, 0]}
        label="👁️  PEEK"
        subLabel={
          frontCar
            ? `FRONT = ${CAR_STYLES[frontCar.styleIdx].name}`
            : "queue empty"
        }
        color="#92400e"
        width={2.0}
        height={0.58}
        disabled={queue.length === 0}
        onClick={onPeek}
      />

      {/* car selector */}
      <Text
        position={[-3.7, 0.68, 0]}
        fontSize={0.12}
        color="#475569"
        anchorX="left"
        anchorY="middle"
      >
        ── SELECT CAR TYPE ──────────────────────
      </Text>
      {CAR_STYLES.slice(0, 4).map((s, i) => (
        <CarChip
          key={i}
          position={[-3.0 + i * 1.07, 0.25, 0]}
          style={s}
          isSelected={enqueueStyleIdx === i}
          onClick={() => onSelectStyle(i)}
        />
      ))}
      {CAR_STYLES.slice(4).map((s, i) => (
        <CarChip
          key={i + 4}
          position={[-3.0 + i * 1.07, -0.3, 0]}
          style={s}
          isSelected={enqueueStyleIdx === i + 4}
          onClick={() => onSelectStyle(i + 4)}
        />
      ))}

      {/* utilities */}
      <Text
        position={[-3.7, -0.85, 0]}
        fontSize={0.12}
        color="#475569"
        anchorX="left"
        anchorY="middle"
      >
        ── UTILITIES ────────────────────────────
      </Text>
      <Button3D
        position={[-2.3, -1.25, 0]}
        label={autoMode ? "⏹  STOP AUTO" : "⚡  AUTO FLOW"}
        subLabel={autoMode ? "stop simulation" : "simulate traffic"}
        color={autoMode ? "#991b1b" : "#5b21b6"}
        width={2.8}
        height={0.58}
        onClick={onToggleAuto}
      />
      <Button3D
        position={[1.5, -1.25, 0]}
        label="🔄  RESET"
        subLabel="restore default queue"
        color="#1e293b"
        width={2.1}
        height={0.58}
        disabled={isAnimating}
        onClick={onReset}
      />

      {/* complexity table */}
      <Text
        position={[-3.7, -1.9, 0]}
        fontSize={0.12}
        color="#475569"
        anchorX="left"
        anchorY="middle"
      >
        ── TIME COMPLEXITY ──────────────────────
      </Text>
      {[
        ["Enqueue (rear)", "O(1)", true, -3.1],
        ["Dequeue (front)", "O(1)", true, -0.8],
        ["Peek front", "O(1)", true, 1.3],
        ["Search", "O(n)", false, 3.4],
      ].map(([op, c, fast, x]) => (
        <group key={op} position={[x, -2.22, 0]}>
          <RoundedBox args={[1.85, 0.32, 0.07]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </RoundedBox>
          <Text
            position={[-0.68, 0, 0.05]}
            fontSize={0.1}
            color="#94a3b8"
            anchorX="left"
            anchorY="middle"
          >
            {op}
          </Text>
          <Text
            position={[0.72, 0, 0.05]}
            fontSize={0.115}
            color={fast ? "#4ade80" : "#f87171"}
            anchorX="right"
            anchorY="middle"
          >
            {c}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ─── 3D Car ────────────────────────────────────────────────────────────────────
function Car({
  queueIndex,
  style,
  isFront,
  isRear,
  isExiting,
  isEntering,
  onExitDone,
  onEnterDone,
}) {
  const groupRef = useRef();
  const wheelFL = useRef(),
    wheelFR = useRef(),
    wheelBL = useRef(),
    wheelBR = useRef();
  const lightRef = useRef();
  const targetX = GATE_X + CAR_SPACING + queueIndex * CAR_SPACING;

  useEffect(() => {
    if (!groupRef.current) return;
    if (isEntering) {
      groupRef.current.position.set(targetX + 14, ROAD_Y + CAR_H / 2, LANE_Z);
      gsap.to(groupRef.current.position, {
        x: targetX,
        duration: 0.9,
        ease: "power2.out",
        onComplete: onEnterDone,
      });
    } else {
      groupRef.current.position.set(targetX + 6, ROAD_Y + CAR_H / 2, LANE_Z);
      gsap.to(groupRef.current.position, {
        x: targetX,
        duration: 0.7,
        ease: "power2.out",
        delay: queueIndex * 0.1,
      });
    }
  }, []);

  useEffect(() => {
    if (!groupRef.current || isEntering) return;
    gsap.to(groupRef.current.position, {
      x: targetX,
      duration: 0.65,
      ease: "power2.inOut",
    });
  }, [targetX]);

  useEffect(() => {
    if (isExiting && groupRef.current) {
      gsap.to(groupRef.current.position, {
        x: GATE_X - 8,
        duration: 0.75,
        ease: "power2.in",
        onComplete: onExitDone,
      });
      gsap.to(groupRef.current.scale, {
        x: 0.92,
        y: 0.92,
        z: 0.92,
        duration: 0.75,
      });
    }
  }, [isExiting]);

  useFrame(({ clock }) => {
    const spin = clock.elapsedTime * 4;
    if (wheelFL.current) wheelFL.current.rotation.z = spin;
    if (wheelFR.current) wheelFR.current.rotation.z = spin;
    if (wheelBL.current) wheelBL.current.rotation.z = spin;
    if (wheelBR.current) wheelBR.current.rotation.z = spin;
    if (lightRef.current && isFront)
      lightRef.current.material.emissiveIntensity =
        0.5 + Math.sin(clock.elapsedTime * 3) * 0.3;
  });

  return (
    <group ref={groupRef}>
      <RoundedBox args={[CAR_L, CAR_H, CAR_W]} radius={0.07} smoothness={4}>
        <meshStandardMaterial
          color={style.body}
          roughness={0.35}
          metalness={0.25}
        />
      </RoundedBox>
      <mesh position={[0.08, CAR_H / 2 + 0.17, 0]}>
        <boxGeometry args={[CAR_L * 0.55, 0.31, CAR_W * 0.78]} />
        <meshStandardMaterial
          color={style.roof}
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>
      <mesh
        position={[CAR_L * 0.18, CAR_H / 2 + 0.21, 0]}
        rotation={[0, 0, -0.42]}
      >
        <boxGeometry args={[0.36, 0.01, CAR_W * 0.72]} />
        <meshStandardMaterial
          color="#a0d4f5"
          roughness={0.1}
          metalness={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh
        position={[-CAR_L * 0.15, CAR_H / 2 + 0.21, 0]}
        rotation={[0, 0, 0.4]}
      >
        <boxGeometry args={[0.33, 0.01, CAR_W * 0.72]} />
        <meshStandardMaterial
          color="#a0d4f5"
          roughness={0.1}
          metalness={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[0.08, CAR_H / 2 + 0.22, side * CAR_W * 0.395]}>
          <boxGeometry args={[CAR_L * 0.42, 0.23, 0.01]} />
          <meshStandardMaterial
            color="#b8dff5"
            roughness={0.1}
            transparent
            opacity={0.65}
          />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[CAR_L / 2 - 0.05, 0.04, side * 0.3]}>
          <boxGeometry args={[0.06, 0.12, 0.18]} />
          <meshStandardMaterial
            color="#fffde0"
            emissive="#fffde0"
            emissiveIntensity={0.6}
            roughness={0.1}
          />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh
          key={i}
          ref={i === 0 ? lightRef : null}
          position={[-(CAR_L / 2 - 0.05), 0.04, side * 0.3]}
        >
          <boxGeometry args={[0.05, 0.1, 0.16]} />
          <meshStandardMaterial
            color="#ff2222"
            emissive="#ff0000"
            emissiveIntensity={isFront ? 0.8 : 0.2}
            roughness={0.1}
          />
        </mesh>
      ))}
      {[
        [CAR_L * 0.34, -CAR_H * 0.42, CAR_W / 2 + 0.04, wheelFL],
        [CAR_L * 0.34, -CAR_H * 0.42, -CAR_W / 2 - 0.04, wheelFR],
        [-CAR_L * 0.34, -CAR_H * 0.42, CAR_W / 2 + 0.04, wheelBL],
        [-CAR_L * 0.34, -CAR_H * 0.42, -CAR_W / 2 - 0.04, wheelBR],
      ].map(([x, y, z, ref], i) => (
        <group key={i} ref={ref} position={[x, y, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.14, 18]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, z > 0 ? 0.08 : -0.08]}
          >
            <cylinderGeometry args={[0.1, 0.1, 0.02, 12]} />
            <meshStandardMaterial
              color="#b0b0b0"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[CAR_L / 2 - 0.01, -0.08, 0]}>
        <boxGeometry args={[0.02, 0.12, 0.36]} />
        <meshStandardMaterial color="#f5f5dc" roughness={0.8} />
      </mesh>
      <Text
        position={[CAR_L / 2 + 0.02, -0.08, 0]}
        fontSize={0.065}
        color="#1a1a1a"
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        {style.plate}
      </Text>
      {isFront && (
        <group position={[0, CAR_H + 0.32, 0]}>
          <RoundedBox args={[0.72, 0.22, 0.12]} radius={0.04} smoothness={4}>
            <meshStandardMaterial
              color="#2ecc71"
              emissive="#2ecc71"
              emissiveIntensity={0.5}
              roughness={0.4}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.07]}
            fontSize={0.095}
            color="#fff"
            anchorX="center"
            anchorY="middle"
          >
            FRONT ←
          </Text>
        </group>
      )}
      {isRear && (
        <group position={[0, CAR_H + 0.32, 0]}>
          <RoundedBox args={[0.72, 0.22, 0.12]} radius={0.04} smoothness={4}>
            <meshStandardMaterial
              color="#e74c3c"
              emissive="#e74c3c"
              emissiveIntensity={0.4}
              roughness={0.4}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.07]}
            fontSize={0.095}
            color="#fff"
            anchorX="center"
            anchorY="middle"
          >
            → REAR
          </Text>
        </group>
      )}
      <group position={[0, -(CAR_H / 2 + 0.28), 0]}>
        <RoundedBox args={[0.52, 0.2, 0.08]} radius={0.03} smoothness={4}>
          <meshStandardMaterial
            color={isFront ? "#2ecc71" : isRear ? "#e74c3c" : "#0f1923"}
            roughness={0.4}
          />
        </RoundedBox>
        <Text
          position={[0, 0, 0.05]}
          fontSize={0.1}
          color={isFront || isRear ? "#fff" : "#7ec8e3"}
          anchorX="center"
          anchorY="middle"
        >
          [{queueIndex}]
        </Text>
      </group>
    </group>
  );
}

// ─── Toll Gate ─────────────────────────────────────────────────────────────────
function TollGate({ isOpen }) {
  const armRef = useRef();
  useEffect(() => {
    if (!armRef.current) return;
    gsap.to(armRef.current.rotation, {
      z: isOpen ? -Math.PI / 2 : 0,
      duration: 0.45,
      ease: "power2.inOut",
    });
  }, [isOpen]);
  return (
    <group position={[GATE_X, ROAD_Y, 0]}>
      <RoundedBox
        args={[0.7, 1.6, 0.9]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.8, -0.85]}
      >
        <meshStandardMaterial
          color="#e8e0d0"
          roughness={0.6}
          metalness={0.05}
        />
      </RoundedBox>
      <mesh position={[0, 1.64, -0.85]}>
        <boxGeometry args={[0.76, 0.1, 0.96]} />
        <meshStandardMaterial color="#2ecc71" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.85, -0.85]}>
        <boxGeometry args={[0.65, 0.28, 0.06]} />
        <meshStandardMaterial color="#f39c12" roughness={0.5} />
      </mesh>
      <Text
        position={[0, 1.85, -0.82]}
        fontSize={0.1}
        color="#1a1a1a"
        anchorX="center"
        anchorY="middle"
      >
        TOLL GATE
      </Text>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.1, 1.5, 0.1]} />
        <meshStandardMaterial color="#bdc3c7" roughness={0.5} metalness={0.5} />
      </mesh>
      <group ref={armRef} position={[0, 1.45, 0]}>
        <mesh position={[1.4, 0, 0]}>
          <boxGeometry args={[2.7, 0.08, 0.08]} />
          <meshStandardMaterial
            color={isOpen ? "#2ecc71" : "#e74c3c"}
            emissive={isOpen ? "#2ecc71" : "#e74c3c"}
            emissiveIntensity={0.35}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
        {[0.5, 1.0, 1.5, 2.0, 2.5].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.14, 0.09, 0.09]} />
            <meshStandardMaterial color="#f5f5f5" roughness={0.5} />
          </mesh>
        ))}
      </group>
      <group position={[0, 1.9, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.42, 0.16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.1, 0.09]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshStandardMaterial
            color={isOpen ? "#2ecc71" : "#333"}
            emissive={isOpen ? "#2ecc71" : "#000"}
            emissiveIntensity={isOpen ? 1.2 : 0}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, -0.1, 0.09]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshStandardMaterial
            color={!isOpen ? "#e74c3c" : "#333"}
            emissive={!isOpen ? "#e74c3c" : "#000"}
            emissiveIntensity={!isOpen ? 1.2 : 0}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─── Road ─────────────────────────────────────────────────────────────────────
function Road({ queueLength }) {
  const roadLen = 24;
  return (
    <group position={[0, ROAD_Y, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[roadLen, 0.08, 3.2]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.95} />
      </mesh>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} position={[-roadLen / 2 + 1.5 + i * 1.72, 0.045, 0]}>
          <boxGeometry args={[0.85, 0.01, 0.06]} />
          <meshStandardMaterial color="#f5c518" roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[0, 0.045, side * 1.48]}>
          <boxGeometry args={[roadLen, 0.01, 0.06]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[roadLen + 4, 0.06, 9]} />
        <meshStandardMaterial color="#2d4a1e" roughness={0.95} />
      </mesh>
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[0, 0.06, side * 2.6]}>
          <boxGeometry args={[roadLen, 0.12, 1.4]} />
          <meshStandardMaterial color="#8a8a7a" roughness={0.9} />
        </mesh>
      ))}
      <mesh
        position={[GATE_X + CAR_SPACING + queueLength * CAR_SPACING, 0.05, 0]}
      >
        <boxGeometry args={[0.06, 0.02, 3.2]} />
        <meshStandardMaterial
          color="#e74c3c"
          emissive="#e74c3c"
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

// ─── Full AR World — everything is 3D, camera-facing panels ──────────────────
function ARWorld({
  queue,
  exitingId,
  enteringId,
  isGateOpen,
  isAnimating,
  autoMode,
  enqueueStyleIdx,
  frontCar,
  rearCar,
  lastLog,
  onExitDone,
  onEnterDone,
  onEnqueue,
  onDequeue,
  onPeek,
  onToggleAuto,
  onReset,
  onSelectStyle,
  onExitAR,
}) {
  const uiRef = useRef();

  // Panels always face the camera (billboard Y)
  useFrame(({ camera }) => {
    if (!uiRef.current) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    uiRef.current.rotation.y = Math.atan2(dir.x, dir.z);
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 8, 4]} intensity={1.7} castShadow />
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.55}
        color="#b0c8ff"
      />
      <pointLight position={[0, 1.5, 0]} intensity={0.8} color="#ffe8a0" />

      {/* The toll gate world, scaled for AR */}
      <group scale={AR_SCALE} position={[0, -0.6, -2.0]}>
        <Road queueLength={queue.length} />
        <TollGate isOpen={isGateOpen} />
        {queue.map((car, i) => (
          <Car
            key={car.id}
            queueIndex={i}
            style={CAR_STYLES[car.styleIdx]}
            isFront={i === 0}
            isRear={i === queue.length - 1}
            isExiting={exitingId === car.id}
            isEntering={enteringId === car.id}
            onExitDone={i === 0 ? onExitDone : undefined}
            onEnterDone={i === queue.length - 1 ? onEnterDone : undefined}
          />
        ))}
        {queue.length === 0 && (
          <Text
            position={[0, ROAD_Y + 0.9, 0]}
            fontSize={0.18}
            color="#4a6a4a"
            anchorX="center"
            anchorY="middle"
          >
            Queue Empty — Tap ENQUEUE!
          </Text>
        )}
      </group>

      {/* 3D UI panels — float in front of user, face camera */}
      <group ref={uiRef} position={[0, 0.08, -2.1]}>
        {/* Status panel — floats ABOVE the scene */}
        <StatusPanel
          position={[0, 0.72, 0]}
          queue={queue}
          isGateOpen={isGateOpen}
          frontCar={frontCar}
          rearCar={rearCar}
          lastLog={lastLog}
          autoMode={autoMode}
        />

        {/* Control panel — floats BELOW the scene */}
        <ControlPanel
          position={[0, -0.68, 0]}
          queue={queue}
          isAnimating={isAnimating}
          autoMode={autoMode}
          enqueueStyleIdx={enqueueStyleIdx}
          frontCar={frontCar}
          onEnqueue={onEnqueue}
          onDequeue={onDequeue}
          onPeek={onPeek}
          onToggleAuto={onToggleAuto}
          onReset={onReset}
          onSelectStyle={onSelectStyle}
        />

        {/* Exit AR button — top-right corner */}
        <Button3D
          position={[3.8, 0.72, 0.02]}
          label="✕  EXIT AR"
          color="#7f1d1d"
          textColor="#fca5a5"
          width={1.3}
          height={0.38}
          onClick={onExitAR}
        />
      </group>
    </>
  );
}

// ─── Regular 3D Scene (non-AR) ────────────────────────────────────────────────
function Scene3D({
  queue,
  exitingId,
  enteringId,
  isGateOpen,
  onExitDone,
  onEnterDone,
}) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 4]} intensity={1.0} castShadow />
      <directionalLight
        position={[-4, 5, -2]}
        intensity={0.3}
        color="#b0c8e0"
      />
      <pointLight position={[GATE_X, 2.5, 0]} intensity={0.8} color="#ffe8a0" />
      <Road queueLength={queue.length} />
      <TollGate isOpen={isGateOpen} />
      {queue.map((car, i) => (
        <Car
          key={car.id}
          queueIndex={i}
          style={CAR_STYLES[car.styleIdx]}
          isFront={i === 0}
          isRear={i === queue.length - 1}
          isExiting={exitingId === car.id}
          isEntering={enteringId === car.id}
          onExitDone={i === 0 ? onExitDone : undefined}
          onEnterDone={i === queue.length - 1 ? onEnterDone : undefined}
        />
      ))}
      {queue.length === 0 && (
        <Text
          position={[0, ROAD_Y + 0.9, 0]}
          fontSize={0.18}
          color="#4a6a4a"
          anchorX="center"
          anchorY="middle"
        >
          Queue Empty — Enqueue a car!
        </Text>
      )}
      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={18}
        target={[0.5, 0, 0]}
      />
      <Environment preset="dawn" />
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const INITIAL_QUEUE = [
  { id: 1, styleIdx: 0 },
  { id: 2, styleIdx: 1 },
  { id: 3, styleIdx: 2 },
];
let nextCarId = 10;

export default function CarTollGate() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [isAnimating, setIsAnimating] = useState(false);
  const [exitingId, setExitingId] = useState(null);
  const [enteringId, setEnteringId] = useState(null);
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("enqueue");
  const [enqueueStyleIdx, setEnqueueStyleIdx] = useState(3);
  const [log, setLog] = useState([]);
  const [autoMode, setAutoMode] = useState(false);
  const [isARMode, setIsARMode] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [arError, setArError] = useState(null);
  const autoRef = useRef(null);

  useEffect(() => {
    if (navigator.xr) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then(setArSupported)
        .catch(() => setArSupported(false));
    }
  }, []);

  const addLog = (msg, type = "info") =>
    setLog((p) => [{ msg, type, id: Date.now() }, ...p].slice(0, 8));

  const frontCar = queue.length > 0 ? queue[0] : null;
  const rearCar = queue.length > 0 ? queue[queue.length - 1] : null;
  const lastLog = log[0] || null;

  const handleEnqueue = useCallback(() => {
    if (isAnimating) return;
    if (queue.length >= MAX_QUEUE)
      return addLog(`⚠️ Queue Full! Max ${MAX_QUEUE} cars.`, "error");
    setIsAnimating(true);
    const newCar = { id: nextCarId++, styleIdx: enqueueStyleIdx };
    setQueue((p) => [...p, newCar]);
    setEnteringId(newCar.id);
    addLog(
      `🚗 Enqueue "${CAR_STYLES[enqueueStyleIdx].name}" → joins REAR [${queue.length}]  ·  O(1)`,
      "success",
    );
  }, [isAnimating, queue.length, enqueueStyleIdx]);

  const handleEnterDone = () => {
    setEnteringId(null);
    setIsAnimating(false);
  };

  const handleDequeue = useCallback(() => {
    if (isAnimating || queue.length === 0) return;
    setIsAnimating(true);
    setIsGateOpen(true);
    const front = queue[0];
    setExitingId(front.id);
    addLog(
      `✅ Dequeue "${CAR_STYLES[front.styleIdx].name}" exits FRONT [0]  ·  O(1)`,
      "success",
    );
  }, [isAnimating, queue]);

  const handleExitDone = () => {
    setQueue((p) => p.slice(1));
    setExitingId(null);
    setIsAnimating(false);
    setTimeout(() => setIsGateOpen(false), 400);
  };

  const handlePeek = useCallback(() => {
    if (queue.length === 0) return addLog("⚠️ Queue is empty!", "error");
    addLog(
      `👁️ Peek FRONT [0] = "${CAR_STYLES[frontCar.styleIdx].name}" (${CAR_STYLES[frontCar.styleIdx].plate})  ·  O(1)`,
      "success",
    );
  }, [queue, frontCar]);

  const toggleAuto = useCallback(() => {
    if (autoMode) {
      clearInterval(autoRef.current);
      setAutoMode(false);
      addLog("⏹ Auto mode stopped", "info");
    } else {
      setAutoMode(true);
      addLog("▶ Auto mode started", "info");
    }
  }, [autoMode]);

  useEffect(() => {
    if (!autoMode) return;
    autoRef.current = setInterval(() => {
      setQueue((prev) => {
        if (isAnimating) return prev;
        const rand = Math.random();
        if (prev.length === 0 || (prev.length < MAX_QUEUE && rand > 0.45)) {
          const styleIdx = Math.floor(Math.random() * CAR_STYLES.length);
          const newCar = { id: nextCarId++, styleIdx };
          setEnteringId(newCar.id);
          setIsAnimating(true);
          setLog((l) =>
            [
              {
                msg: `🚗 Auto: "${CAR_STYLES[styleIdx].name}" joins REAR [${prev.length}]`,
                type: "success",
                id: Date.now(),
              },
              ...l,
            ].slice(0, 8),
          );
          return [...prev, newCar];
        } else if (prev.length > 0) {
          const front = prev[0];
          setIsGateOpen(true);
          setExitingId(front.id);
          setIsAnimating(true);
          setLog((l) =>
            [
              {
                msg: `✅ Auto: "${CAR_STYLES[front.styleIdx].name}" exits FRONT`,
                type: "success",
                id: Date.now(),
              },
              ...l,
            ].slice(0, 8),
          );
          return prev;
        }
        return prev;
      });
    }, 1800);
    return () => clearInterval(autoRef.current);
  }, [autoMode, isAnimating]);

  const handleReset = useCallback(() => {
    if (isAnimating) return;
    clearInterval(autoRef.current);
    setAutoMode(false);
    setQueue(INITIAL_QUEUE);
    setIsGateOpen(false);
    setLog([]);
  }, [isAnimating]);

  const handleLaunchAR = () => {
    setArError(null);
    xrStore
      .enterAR()
      .then(() => setIsARMode(true))
      .catch((e) => setArError("AR failed: " + (e?.message || "Unknown")));
  };
  const handleExitAR = () => {
    try {
      xrStore.getState()?.session?.end();
    } catch {}
    setIsARMode(false);
  };

  const tabBtn = (tab, emoji, label) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${activeTab === tab ? "bg-yellow-400 border-yellow-400 text-gray-900" : "bg-transparent border-white/20 text-white/60 hover:border-yellow-400/50 hover:text-white"}`}
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
        <h2 className="text-3xl font-bold text-yellow-300 tracking-widest">
          🚗 CAR TOLL GATE
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Queue:{" "}
          <span className="text-yellow-300 font-bold">{queue.length}</span> /{" "}
          {MAX_QUEUE} cars
          {queue.length > 0 && frontCar && (
            <>
              {" "}
              &nbsp;·&nbsp; FRONT:{" "}
              <span className="text-green-300 font-bold">
                [0] {CAR_STYLES[frontCar.styleIdx].name}
              </span>
              &nbsp;·&nbsp; REAR:{" "}
              <span className="text-red-300 font-bold">
                [{queue.length - 1}] {CAR_STYLES[rearCar.styleIdx].name}
              </span>
            </>
          )}
          {queue.length === 0 && (
            <span className="text-white/40 ml-2">[ EMPTY ]</span>
          )}
          {autoMode && (
            <span className="text-yellow-400 ml-2 animate-pulse font-bold">
              ● AUTO
            </span>
          )}
        </p>
      </div>

      {/* AR launch */}
      <div className="flex flex-col items-center gap-2">
        {arSupported ? (
          <button
            onClick={handleLaunchAR}
            className="flex items-center gap-3 px-7 py-3.5 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#4f46e5,#7c3aed,#9333ea)",
              boxShadow: "0 0 30px rgba(124,58,237,0.55)",
              fontFamily: "'Courier New',monospace",
              fontSize: 15,
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span style={{ fontSize: 22 }}>📷</span>
            <span>Launch Full AR Mode</span>
            <span
              style={{
                fontSize: 10,
                opacity: 0.7,
                background: "rgba(255,255,255,0.12)",
                padding: "2px 7px",
                borderRadius: 6,
              }}
            >
              All UI = 3D in AR
            </span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1 px-6 py-3 rounded-2xl border border-white/10 bg-white/5">
            <span className="text-white/50 text-sm">
              📵 AR not supported on this device/browser
            </span>
            <span className="text-white/30 text-xs">
              Requires Android Chrome or iOS Safari 17+ with WebXR
            </span>
          </div>
        )}
        {arError && <p className="text-red-400 text-xs">{arError}</p>}
      </div>

      {/* Canvas */}
      <div
        className={`w-full rounded-2xl overflow-hidden border-2 border-yellow-400/30 ${isARMode ? "fixed inset-0 z-50 rounded-none border-0" : ""}`}
        style={{
          height: isARMode ? "100vh" : 420,
          background: isARMode
            ? "transparent"
            : "linear-gradient(180deg,#080c04 0%,#111a08 50%,#060a03 100%)",
        }}
      >
        <Canvas
          camera={{ position: [1, 4.5, 9.5], fov: 48 }}
          shadows
          gl={{ alpha: true, antialias: true, xrCompatible: true }}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            display: "block",
          }}
          onCreated={({ gl }) => {
            gl.xr.enabled = true;
          }}
        >
          <XR store={xrStore}>
            {isARMode ? (
              <ARWorld
                queue={queue}
                exitingId={exitingId}
                enteringId={enteringId}
                isGateOpen={isGateOpen}
                isAnimating={isAnimating}
                autoMode={autoMode}
                enqueueStyleIdx={enqueueStyleIdx}
                frontCar={frontCar}
                rearCar={rearCar}
                lastLog={lastLog}
                onExitDone={handleExitDone}
                onEnterDone={handleEnterDone}
                onEnqueue={handleEnqueue}
                onDequeue={handleDequeue}
                onPeek={handlePeek}
                onToggleAuto={toggleAuto}
                onReset={handleReset}
                onSelectStyle={setEnqueueStyleIdx}
                onExitAR={handleExitAR}
              />
            ) : (
              <Scene3D
                queue={queue}
                exitingId={exitingId}
                enteringId={enteringId}
                isGateOpen={isGateOpen}
                onExitDone={handleExitDone}
                onEnterDone={handleEnterDone}
              />
            )}
          </XR>
        </Canvas>
      </div>

      {/* Regular UI (hidden in AR) */}
      {!isARMode && (
        <>
          <div className="flex gap-1 flex-wrap justify-center items-center">
            <div className="flex items-center gap-1 px-2 py-1 bg-green-400/15 border border-green-400/30 rounded-lg mr-1">
              <span className="text-green-400 text-xs font-bold">GATE ←</span>
            </div>
            {queue.length === 0 ? (
              <span className="text-white/20 text-xs italic px-3 py-1 border border-white/10 rounded-lg">
                [ empty queue ]
              </span>
            ) : (
              queue.map((car, i) => (
                <div
                  key={car.id}
                  className={`flex flex-col items-center px-2 py-1 rounded-lg border text-xs transition-all ${i === 0 ? "border-green-400 bg-green-400/20 text-green-300" : i === queue.length - 1 ? "border-red-400 bg-red-400/20 text-red-300" : "border-white/20 bg-white/10 text-white/70"}`}
                >
                  <span>🚗</span>
                  <span className="font-mono font-bold">[{i}]</span>
                  {i === 0 && (
                    <span className="text-[9px] text-green-400 font-bold">
                      FRONT
                    </span>
                  )}
                  {i === queue.length - 1 && queue.length > 1 && (
                    <span className="text-[9px] text-red-400 font-bold">
                      REAR
                    </span>
                  )}
                </div>
              ))
            )}
            <div className="flex items-center gap-1 px-2 py-1 bg-red-400/15 border border-red-400/30 rounded-lg ml-1">
              <span className="text-red-400 text-xs font-bold">→ JOIN</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex gap-2 mb-4 flex-wrap">
                {tabBtn("enqueue", "🚗", "Enqueue")}
                {tabBtn("dequeue", "✅", "Dequeue")}
                {tabBtn("peek", "👁️", "Peek")}
                {tabBtn("auto", "⚡", "Auto")}
              </div>
              {activeTab === "enqueue" && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/50 text-xs">
                    Car joins REAR —{" "}
                    <span className="text-green-400 font-bold">O(1)</span>
                  </p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <select
                      value={enqueueStyleIdx}
                      onChange={(e) =>
                        setEnqueueStyleIdx(Number(e.target.value))
                      }
                      className="flex-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-400"
                    >
                      {CAR_STYLES.map((s, i) => (
                        <option key={i} value={i}>
                          🚗 {s.name} ({s.plate})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleEnqueue}
                      disabled={isAnimating || queue.length >= MAX_QUEUE}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-white text-sm font-bold"
                    >
                      Enqueue →
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{
                          width: `${(queue.length / MAX_QUEUE) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-white/40 text-xs">
                      {queue.length}/{MAX_QUEUE}
                    </span>
                  </div>
                </div>
              )}
              {activeTab === "dequeue" && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/50 text-xs">
                    FRONT exits —{" "}
                    <span className="text-green-400 font-bold">O(1)</span> ·
                    FIFO
                  </p>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={handleDequeue}
                      disabled={isAnimating || queue.length === 0}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg text-white text-sm font-bold"
                    >
                      ← Dequeue
                    </button>
                    {frontCar && (
                      <span className="text-white/50 text-xs">
                        Next:{" "}
                        <span className="text-green-300 font-bold">
                          🚗 {CAR_STYLES[frontCar.styleIdx].name}
                        </span>
                      </span>
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${isGateOpen ? "border-green-400/50 bg-green-400/10 text-green-300" : "border-white/10 bg-white/5 text-white/40"}`}
                  >
                    Gate:{" "}
                    <span className="font-bold">
                      {isGateOpen ? "🟢 OPEN" : "🔴 CLOSED"}
                    </span>
                  </div>
                </div>
              )}
              {activeTab === "peek" && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/50 text-xs">
                    See who's next —{" "}
                    <span className="text-green-400 font-bold">O(1)</span>
                  </p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <button
                      onClick={handlePeek}
                      disabled={queue.length === 0}
                      className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 rounded-lg text-white text-sm font-bold"
                    >
                      👁️ Peek FRONT
                    </button>
                    {frontCar && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-400/15 border border-yellow-400/40 rounded-lg">
                        <span className="text-xl">🚗</span>
                        <div>
                          <p className="text-yellow-300 text-xs font-bold">
                            FRONT [0]
                          </p>
                          <p className="text-white/70 text-xs">
                            {CAR_STYLES[frontCar.styleIdx].name} ·{" "}
                            {CAR_STYLES[frontCar.styleIdx].plate}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "auto" && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/50 text-xs">
                    Simulate real-time traffic
                  </p>
                  <button
                    onClick={toggleAuto}
                    className={`px-5 py-2.5 rounded-lg text-white text-sm font-bold ${autoMode ? "bg-red-600 hover:bg-red-500 animate-pulse" : "bg-yellow-600 hover:bg-yellow-500"}`}
                  >
                    {autoMode ? "⏹ Stop Auto" : "⚡ Start Auto Flow"}
                  </button>
                </div>
              )}
              <button
                onClick={handleReset}
                disabled={isAnimating}
                className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-sm disabled:opacity-40"
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
                        className={`text-xs font-mono py-1 px-2 rounded border-l-2 ${entry.type === "success" ? "border-green-400 bg-green-400/5 text-green-300" : entry.type === "error" ? "border-red-400 bg-red-400/5 text-red-300" : "border-blue-400 bg-blue-400/5 text-blue-300"} ${i > 0 ? "opacity-50" : ""}`}
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
                    ["Enqueue (rear)", "O(1)", true],
                    ["Dequeue (front)", "O(1)", true],
                    ["Peek front", "O(1)", true],
                    ["isEmpty check", "O(1)", true],
                    ["Search", "O(n)", false],
                    ["Size / Length", "O(1)", true],
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
            💡 Cars join REAR → exit FRONT · 📷 AR mode: all buttons become 3D
            holo-panels in your real world
          </p>
        </>
      )}
    </div>
  );
}
