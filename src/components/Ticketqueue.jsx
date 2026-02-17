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

// ─── Constants ─────────────────────────────────────────────────────────────────
const CARD_W = 0.72;
const CARD_H = 0.02;
const CARD_D = 1.0;
const CARD_SPACING = 1.02;
const LANE_Y = -0.5;
const DESK_Y = -0.72;
const MAX_QUEUE = 7;
const WINDOW_X = -3.6; // processing window on the left

const TICKET_STYLES = [
  {
    color: "#e74c3c",
    accent: "#c0392b",
    type: "MEDICAL",
    num: "A-001",
    icon: "🏥",
  },
  {
    color: "#3498db",
    accent: "#2471a3",
    type: "BILLING",
    num: "B-002",
    icon: "💳",
  },
  {
    color: "#2ecc71",
    accent: "#1e8449",
    type: "RECORDS",
    num: "C-003",
    icon: "📋",
  },
  {
    color: "#f39c12",
    accent: "#d68910",
    type: "INQUIRY",
    num: "D-004",
    icon: "❓",
  },
  {
    color: "#9b59b6",
    accent: "#7d3c98",
    type: "RENEWAL",
    num: "E-005",
    icon: "🔄",
  },
  {
    color: "#1abc9c",
    accent: "#148f77",
    type: "COMPLAINT",
    num: "F-006",
    icon: "📣",
  },
  {
    color: "#e67e22",
    accent: "#ca6f1e",
    type: "PERMIT",
    num: "G-007",
    icon: "📜",
  },
  {
    color: "#e91e63",
    accent: "#c2185b",
    type: "APPROVAL",
    num: "H-008",
    icon: "✅",
  },
];

// ─── Single Ticket Card ────────────────────────────────────────────────────────
function TicketCard({
  queueIndex,
  totalCount,
  style,
  isFront,
  isRear,
  isEntering,
  isProcessing,
  isExiting,
  onEnterDone,
  onExitDone,
}) {
  const groupRef = useRef();
  const glowRef = useRef();

  // X position: FRONT (index 0) closest to window (left), REAR furthest right
  const targetX = WINDOW_X + CARD_SPACING + queueIndex * CARD_SPACING;

  // Initial entrance — card slides in from right
  useEffect(() => {
    if (!groupRef.current) return;
    if (isEntering) {
      groupRef.current.position.set(targetX + 10, LANE_Y, 0);
      gsap.to(groupRef.current.position, {
        x: targetX,
        duration: 0.6,
        ease: "power2.out",
        onComplete: onEnterDone,
      });
    } else {
      groupRef.current.position.set(targetX + 5, LANE_Y, 0);
      gsap.to(groupRef.current.position, {
        x: targetX,
        duration: 0.55,
        ease: "power2.out",
        delay: queueIndex * 0.07,
      });
    }
  }, []);

  // Slide forward as queue shifts
  useEffect(() => {
    if (!groupRef.current || isEntering || isExiting) return;
    gsap.to(groupRef.current.position, {
      x: targetX,
      duration: 0.55,
      ease: "power2.inOut",
    });
  }, [targetX]);

  // Exit animation — card slides into window on the left
  useEffect(() => {
    if (!groupRef.current || !isExiting) return;
    gsap.to(groupRef.current.position, {
      x: WINDOW_X - 3.5,
      y: LANE_Y + 0.4,
      duration: 0.65,
      ease: "power3.in",
      onComplete: onExitDone,
    });
    gsap.to(groupRef.current.scale, {
      x: 0.7,
      y: 0.7,
      z: 0.7,
      duration: 0.65,
      ease: "power3.in",
    });
  }, [isExiting]);

  // Hover float for front card
  useFrame((state) => {
    if (!groupRef.current || isExiting) return;
    if (isFront) {
      groupRef.current.position.y =
        LANE_Y + Math.sin(state.clock.elapsedTime * 2.2) * 0.04;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        LANE_Y,
        0.1,
      );
    }
    // Glow pulse for processing card
    if (glowRef.current && isProcessing) {
      glowRef.current.material.emissiveIntensity =
        0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={[targetX, LANE_Y, 0]}>
      {/* Card base */}
      <RoundedBox args={[CARD_W, CARD_H, CARD_D]} radius={0.025} smoothness={4}>
        <meshStandardMaterial
          color="#f5f0e8"
          roughness={0.55}
          metalness={0.05}
        />
      </RoundedBox>

      {/* Colored header strip on top face */}
      <mesh position={[0, CARD_H / 2 + 0.001, -CARD_D / 2 + 0.18]}>
        <boxGeometry args={[CARD_W - 0.04, 0.004, 0.34]} />
        <meshStandardMaterial
          color={style.color}
          roughness={0.4}
          emissive={style.color}
          emissiveIntensity={isFront ? 0.35 : 0.1}
        />
      </mesh>

      {/* Accent side stripe */}
      <mesh position={[-CARD_W / 2 + 0.04, CARD_H / 2 + 0.001, 0]}>
        <boxGeometry args={[0.06, 0.004, CARD_D - 0.04]} />
        <meshStandardMaterial color={style.accent} roughness={0.4} />
      </mesh>

      {/* Ticket number text */}
      <Text
        position={[0.06, CARD_H / 2 + 0.006, -0.28]}
        fontSize={0.13}
        color={style.color}
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
        fontWeight="bold"
      >
        {style.num}
      </Text>

      {/* Service type text */}
      <Text
        position={[0.06, CARD_H / 2 + 0.006, 0.05]}
        fontSize={0.09}
        color="#2c2c2c"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
        maxWidth={0.6}
        textAlign="center"
      >
        {style.type}
      </Text>

      {/* Queue number at bottom */}
      <Text
        position={[0.06, CARD_H / 2 + 0.006, 0.35]}
        fontSize={0.075}
        color="#888"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        Queue [{queueIndex}]
      </Text>

      {/* Perforation dots along right edge */}
      {[-0.35, -0.15, 0.05, 0.25, 0.38].map((z, i) => (
        <mesh key={i} position={[CARD_W / 2 - 0.06, CARD_H / 2 + 0.003, z]}>
          <cylinderGeometry args={[0.022, 0.022, 0.006, 10]} />
          <meshStandardMaterial color="#ccc" roughness={0.8} />
        </mesh>
      ))}

      {/* FRONT glow ring */}
      {isFront && (
        <group ref={glowRef} position={[0, CARD_H / 2 + 0.01, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.52, 0.58, 48]} />
            <meshStandardMaterial
              color={style.color}
              emissive={style.color}
              emissiveIntensity={0.9}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* FRONT / REAR floating label */}
      {isFront && (
        <group position={[0, 0.38, -0.3]}>
          <RoundedBox args={[0.65, 0.2, 0.1]} radius={0.04} smoothness={4}>
            <meshStandardMaterial
              color="#2ecc71"
              emissive="#2ecc71"
              emissiveIntensity={0.5}
              roughness={0.4}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.09}
            color="#fff"
            anchorX="center"
            anchorY="middle"
          >
            ← FRONT
          </Text>
        </group>
      )}
      {isRear && (
        <group position={[0, 0.38, -0.3]}>
          <RoundedBox args={[0.65, 0.2, 0.1]} radius={0.04} smoothness={4}>
            <meshStandardMaterial
              color="#e74c3c"
              emissive="#e74c3c"
              emissiveIntensity={0.4}
              roughness={0.4}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.09}
            color="#fff"
            anchorX="center"
            anchorY="middle"
          >
            REAR →
          </Text>
        </group>
      )}
    </group>
  );
}

// ─── Processing Window / Counter ───────────────────────────────────────────────
function ProcessingWindow({ isProcessing, currentTicket }) {
  const lightRef = useRef();

  useFrame((state) => {
    if (!lightRef.current) return;
    lightRef.current.material.emissiveIntensity = isProcessing
      ? 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.3
      : 0.2;
  });

  return (
    <group position={[WINDOW_X - 0.3, DESK_Y + 0.02, 0]}>
      {/* Counter body */}
      <RoundedBox
        args={[1.5, 1.2, 1.1]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.6, -0.3]}
      >
        <meshStandardMaterial
          color="#d5c9b8"
          roughness={0.6}
          metalness={0.05}
        />
      </RoundedBox>
      {/* Counter top */}
      <mesh position={[0, 1.22, -0.3]}>
        <boxGeometry args={[1.55, 0.06, 1.15]} />
        <meshStandardMaterial color="#b8a898" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Window opening */}
      <mesh position={[0.76, 0.75, -0.3]}>
        <boxGeometry args={[0.04, 0.5, 0.7]} />
        <meshStandardMaterial
          color="#a0d4f5"
          transparent
          opacity={0.5}
          roughness={0.1}
        />
      </mesh>
      {/* Service sign */}
      <mesh position={[0, 1.55, -0.3]}>
        <boxGeometry args={[1.3, 0.28, 0.06]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.5} />
      </mesh>
      <Text
        position={[0, 1.55, -0.27]}
        fontSize={0.1}
        color="#ecf0f1"
        anchorX="center"
        anchorY="middle"
      >
        SERVICE WINDOW
      </Text>

      {/* Status indicator light */}
      <mesh ref={lightRef} position={[0, 1.55, -0.58]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color={isProcessing ? "#2ecc71" : "#e74c3c"}
          emissive={isProcessing ? "#2ecc71" : "#e74c3c"}
          emissiveIntensity={0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Now serving display */}
      <mesh position={[0, 1.02, -0.27]}>
        <boxGeometry args={[1.1, 0.22, 0.04]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.5} />
      </mesh>
      <Text
        position={[0, 1.02, -0.25]}
        fontSize={0.08}
        color={currentTicket ? "#f39c12" : "#4a4a6a"}
        anchorX="center"
        anchorY="middle"
      >
        {currentTicket ? `NOW: ${currentTicket.num}` : "NO TICKET"}
      </Text>

      {/* Ticket slot */}
      <mesh position={[0.72, 0.55, -0.3]}>
        <boxGeometry args={[0.06, 0.06, 0.55]} />
        <meshStandardMaterial color="#888" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Bell / buzzer */}
      <mesh position={[0, 1.28, 0.18]}>
        <cylinderGeometry args={[0.1, 0.12, 0.06, 16]} />
        <meshStandardMaterial
          color={isProcessing ? "#f39c12" : "#95a5a6"}
          emissive={isProcessing ? "#f39c12" : "#000"}
          emissiveIntensity={isProcessing ? 0.6 : 0}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}

// ─── Desk / Table Surface ──────────────────────────────────────────────────────
function DeskSurface({ queueLength }) {
  const deskW = 18;
  return (
    <group position={[0, DESK_Y, 0]}>
      {/* Main desk surface */}
      <mesh receiveShadow>
        <boxGeometry args={[deskW, 0.08, 2.0]} />
        <meshStandardMaterial
          color="#c8b89a"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      {/* Desk edge trim */}
      <mesh position={[0, 0.045, 0.98]}>
        <boxGeometry args={[deskW, 0.012, 0.04]} />
        <meshStandardMaterial color="#a89070" roughness={0.5} />
      </mesh>
      {/* Queue lane dividers */}
      {[-0.72, 0.72].map((z, i) => (
        <mesh key={i} position={[0, 0.05, z]}>
          <boxGeometry args={[deskW, 0.02, 0.04]} />
          <meshStandardMaterial color="#9a8060" roughness={0.6} />
        </mesh>
      ))}
      {/* Arrow markers on desk */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[WINDOW_X + 1.5 + i * 2.2, 0.05, 0]}>
          <boxGeometry args={[0.8, 0.006, 0.06]} />
          <meshStandardMaterial
            color="#e8c87a"
            roughness={0.6}
            emissive="#e8c87a"
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
      {/* Rear-end indicator */}
      <mesh
        position={[
          WINDOW_X + CARD_SPACING + queueLength * CARD_SPACING,
          0.05,
          0,
        ]}
      >
        <boxGeometry args={[0.06, 0.02, 2.0]} />
        <meshStandardMaterial
          color="#e74c3c"
          emissive="#e74c3c"
          emissiveIntensity={0.5}
          roughness={0.4}
        />
      </mesh>
      {/* Floor */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[deskW + 4, 0.3, 6]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.9} />
      </mesh>
      {/* Floor tiles grid */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-6 + i * 1.8, -0.05, 0]}>
          <boxGeometry args={[1.75, 0.003, 5.8]} />
          <meshStandardMaterial color="#d8d0c4" roughness={0.9} />
        </mesh>
      ))}
      {/* Rope barrier poles */}
      {Array.from({ length: 5 }).map((_, i) => (
        <group key={i} position={[WINDOW_X + 1.2 + i * 1.9, 0.05, 0.85]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.9, 12]} />
            <meshStandardMaterial
              color="#c8a040"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial
              color="#d4aa44"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
        </group>
      ))}
      {/* Rope between poles */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh
          key={i}
          position={[WINDOW_X + 2.15 + i * 1.9, 0.95, 0.85]}
          rotation={[0, 0, 0]}
        >
          <boxGeometry args={[1.9, 0.02, 0.02]} />
          <meshStandardMaterial color="#c87020" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Pointer arrow indicators ──────────────────────────────────────────────────
function QueuePointers({ frontX, rearX, queueLength }) {
  const frontArrowRef = useRef();
  useFrame((state) => {
    if (frontArrowRef.current) {
      frontArrowRef.current.position.y =
        1.0 + Math.sin(state.clock.elapsedTime * 2.5) * 0.08;
    }
  });
  if (queueLength === 0) return null;
  return (
    <>
      {/* FRONT pointer arrow */}
      <group ref={frontArrowRef} position={[frontX, 1.0, 0.6]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.22, 8]} />
          <meshStandardMaterial
            color="#2ecc71"
            emissive="#2ecc71"
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
          <meshStandardMaterial
            color="#2ecc71"
            emissive="#2ecc71"
            emissiveIntensity={0.5}
          />
        </mesh>
        <Text
          position={[0, 0.46, 0]}
          fontSize={0.1}
          color="#2ecc71"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          FRONT
        </Text>
      </group>

      {/* REAR pointer arrow */}
      {queueLength > 1 && (
        <group position={[rearX, 1.05, 0.6]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.07, 0.22, 8]} />
            <meshStandardMaterial
              color="#e74c3c"
              emissive="#e74c3c"
              emissiveIntensity={0.7}
            />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 8]} />
            <meshStandardMaterial
              color="#e74c3c"
              emissive="#e74c3c"
              emissiveIntensity={0.5}
            />
          </mesh>
          <Text
            position={[0, 0.46, 0]}
            fontSize={0.1}
            color="#e74c3c"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            REAR
          </Text>
        </group>
      )}
    </>
  );
}

// ─── Full 3D Scene ─────────────────────────────────────────────────────────────
function TicketScene({
  queue,
  exitingId,
  enteringId,
  isProcessing,
  onEnterDone,
  onExitDone,
}) {
  // index 0 = FRONT = closest to window, last index = REAR = furthest right
  const frontX = WINDOW_X + CARD_SPACING; // index 0
  const rearX = WINDOW_X + CARD_SPACING + (queue.length - 1) * CARD_SPACING; // last index

  const currentTicket =
    isProcessing && queue.length > 0 ? TICKET_STYLES[queue[0].styleIdx] : null;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 8, 3]} intensity={1.0} castShadow />
      <directionalLight
        position={[-4, 5, -2]}
        intensity={0.3}
        color="#d0c8e0"
      />
      <pointLight position={[WINDOW_X, 2, 0]} intensity={0.8} color="#ffe8c0" />
      <pointLight position={[2, 2, 0]} intensity={0.35} color="#e8e0ff" />

      <DeskSurface queueLength={queue.length} />
      <ProcessingWindow
        isProcessing={isProcessing}
        currentTicket={currentTicket}
      />

      {/* FRONT / REAR pointer arrows */}
      <QueuePointers frontX={frontX} rearX={rearX} queueLength={queue.length} />

      {/* Ticket cards */}
      {queue.map((ticket, i) => (
        <TicketCard
          key={ticket.id}
          queueIndex={i}
          totalCount={queue.length}
          style={TICKET_STYLES[ticket.styleIdx]}
          isFront={i === 0}
          isRear={i === queue.length - 1}
          isEntering={enteringId === ticket.id}
          isProcessing={isProcessing && i === 0}
          isExiting={exitingId === ticket.id}
          onEnterDone={i === queue.length - 1 ? onEnterDone : undefined}
          onExitDone={i === 0 ? onExitDone : undefined}
        />
      ))}

      {/* Empty queue label */}
      {queue.length === 0 && !enteringId && (
        <Text
          position={[0, LANE_Y + 0.5, 0]}
          fontSize={0.18}
          color="#8a7a6a"
          anchorX="center"
          anchorY="middle"
        >
          Queue Empty — Enqueue a ticket!
        </Text>
      )}

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={16}
        target={[0, 0, 0]}
      />
      <Environment preset="lobby" />
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
const INITIAL_QUEUE = [
  { id: 1, styleIdx: 0 },
  { id: 2, styleIdx: 1 },
  { id: 3, styleIdx: 2 },
];
let nextTicketId = 10;

export default function TicketQueue() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exitingId, setExitingId] = useState(null);
  const [enteringId, setEnteringId] = useState(null);
  const [activeTab, setActiveTab] = useState("enqueue");
  const [enqueueStyleIdx, setEnqueueStyleIdx] = useState(3);
  const [log, setLog] = useState([]);
  const processTimerRef = useRef(null);

  const addLog = (msg, type = "info") =>
    setLog((prev) => [{ msg, type, id: Date.now() }, ...prev].slice(0, 8));

  const frontTicket =
    queue.length > 0 ? TICKET_STYLES[queue[0].styleIdx] : null;
  const rearTicket =
    queue.length > 0 ? TICKET_STYLES[queue[queue.length - 1].styleIdx] : null;

  // ── Enqueue ────────────────────────────────────────────────────────────────
  const handleEnqueue = () => {
    if (isAnimating) return;
    if (queue.length >= MAX_QUEUE)
      return addLog(`⚠️ Queue Full! Max ${MAX_QUEUE} tickets.`, "error");
    setIsAnimating(true);
    const newTicket = { id: nextTicketId++, styleIdx: enqueueStyleIdx };
    setQueue((prev) => [...prev, newTicket]);
    setEnteringId(newTicket.id);
    addLog(
      `🎫 Enqueue "${TICKET_STYLES[enqueueStyleIdx].type}" → REAR [${queue.length}]  ·  O(1)`,
      "success",
    );
  };

  const handleEnterDone = () => {
    setEnteringId(null);
    setIsAnimating(false);
  };

  // ── Dequeue / Process ──────────────────────────────────────────────────────
  const handleDequeue = () => {
    if (isAnimating || isProcessing) return;
    if (queue.length === 0)
      return addLog("⚠️ Queue Empty! No tickets to process.", "error");

    const front = queue[0];
    setIsProcessing(true);
    addLog(
      `⚙️ Processing "${TICKET_STYLES[front.styleIdx].type}" [${front.styleIdx}] at window...`,
      "info",
    );

    // Simulate processing time (1.2s), then exit
    processTimerRef.current = setTimeout(() => {
      setIsAnimating(true);
      setExitingId(front.id);
      addLog(
        `✅ Dequeue "${TICKET_STYLES[front.styleIdx].type}" from FRONT [0]  ·  O(1)  ·  Served!`,
        "success",
      );
    }, 1200);
  };

  const handleExitDone = () => {
    setQueue((prev) => prev.slice(1));
    setExitingId(null);
    setIsProcessing(false);
    setIsAnimating(false);
  };

  // ── Peek ───────────────────────────────────────────────────────────────────
  const handlePeek = () => {
    if (queue.length === 0) return addLog("⚠️ Queue is empty!", "error");
    addLog(
      `👁️ Peek FRONT [0] = "${frontTicket.type}" (${frontTicket.num})  ·  O(1)`,
      "success",
    );
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (isAnimating) return;
    clearTimeout(processTimerRef.current);
    setQueue(INITIAL_QUEUE);
    setIsProcessing(false);
    setExitingId(null);
    setEnteringId(null);
    setLog([]);
  };

  const tabBtn = (tab, emoji, label) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
        activeTab === tab
          ? "bg-violet-400 border-violet-400 text-gray-900"
          : "bg-transparent border-white/20 text-white/60 hover:border-violet-400/50 hover:text-white"
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
        <h2 className="text-3xl font-bold text-violet-300 tracking-widest">
          🎫 TICKET QUEUE
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Queue:{" "}
          <span className="text-violet-300 font-bold">{queue.length}</span> /{" "}
          {MAX_QUEUE} tickets
          {queue.length > 0 && frontTicket && (
            <>
              {" "}
              &nbsp;·&nbsp; FRONT:{" "}
              <span className="text-green-300 font-bold">
                [0] {frontTicket.type}
              </span>
              &nbsp;·&nbsp; REAR:{" "}
              <span className="text-red-300 font-bold">
                [{queue.length - 1}] {rearTicket.type}
              </span>
            </>
          )}
          {queue.length === 0 && (
            <span className="text-white/40 ml-2">[ EMPTY ]</span>
          )}
          {isProcessing && (
            <span className="text-violet-400 ml-2 animate-pulse font-bold">
              ⚙️ PROCESSING...
            </span>
          )}
        </p>
      </div>

      {/* 3D Canvas */}
      <div
        className="w-full rounded-2xl overflow-hidden border-2 border-violet-400/30 shadow-[0_0_40px_rgba(167,139,250,0.12)]"
        style={{
          height: 440,
          background:
            "linear-gradient(180deg,#0a0812 0%,#130f1e 50%,#080610 100%)",
        }}
      >
        <Canvas camera={{ position: [0.5, 4.2, 9.0], fov: 46 }} shadows>
          <TicketScene
            queue={queue}
            exitingId={exitingId}
            enteringId={enteringId}
            isProcessing={isProcessing}
            onEnterDone={handleEnterDone}
            onExitDone={handleExitDone}
          />
        </Canvas>
      </div>

      {/* Queue bar */}
      <div className="flex gap-1 flex-wrap justify-center items-center">
        <div className="flex items-center px-2 py-1 bg-green-400/15 border border-green-400/30 rounded-lg mr-1">
          <span className="text-green-400 text-xs font-bold">WINDOW ←</span>
        </div>
        {queue.length === 0 ? (
          <span className="text-white/20 text-xs italic px-3 py-1 border border-white/10 rounded-lg">
            [ empty ]
          </span>
        ) : (
          queue.map((ticket, i) => (
            <div
              key={ticket.id}
              className={`flex flex-col items-center px-2 py-1 rounded-lg border text-xs transition-all ${
                i === 0
                  ? "border-green-400 bg-green-400/20 text-green-300"
                  : i === queue.length - 1
                    ? "border-red-400 bg-red-400/20 text-red-300"
                    : "border-white/20 bg-white/10 text-white/70"
              }`}
              style={{ borderTopColor: TICKET_STYLES[ticket.styleIdx].color }}
            >
              <span>🎫</span>
              <span className="font-mono font-bold text-[10px]">
                {TICKET_STYLES[ticket.styleIdx].num}
              </span>
              {i === 0 && (
                <span className="text-[8px] text-green-400 font-bold">
                  FRONT
                </span>
              )}
              {i === queue.length - 1 && queue.length > 1 && (
                <span className="text-[8px] text-red-400 font-bold">REAR</span>
              )}
            </div>
          ))
        )}
        <div className="flex items-center px-2 py-1 bg-red-400/15 border border-red-400/30 rounded-lg ml-1">
          <span className="text-red-400 text-xs font-bold">→ JOIN</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabBtn("enqueue", "🎫", "Enqueue")}
            {tabBtn("dequeue", "⚙️", "Process")}
            {tabBtn("peek", "👁️", "Peek")}
          </div>

          {/* Enqueue */}
          {activeTab === "enqueue" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                Ticket joins the REAR of the line —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-white/60 text-sm">Type:</span>
                <select
                  value={enqueueStyleIdx}
                  onChange={(e) => setEnqueueStyleIdx(Number(e.target.value))}
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-violet-400"
                >
                  {TICKET_STYLES.map((s, i) => (
                    <option key={i} value={i}>
                      {s.icon} {s.type} ({s.num})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleEnqueue}
                  disabled={isAnimating || queue.length >= MAX_QUEUE}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  Enqueue →
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full transition-all duration-300"
                    style={{ width: `${(queue.length / MAX_QUEUE) * 100}%` }}
                  />
                </div>
                <span className="text-white/40 text-xs">
                  {queue.length}/{MAX_QUEUE}
                </span>
              </div>
              {queue.length >= MAX_QUEUE && (
                <p className="text-red-400 text-xs font-bold">
                  ⚠️ Queue is full!
                </p>
              )}
            </div>
          )}

          {/* Dequeue / Process */}
          {activeTab === "dequeue" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                FRONT ticket goes to service window —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
                &nbsp;· processes for 1.2s then exits
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={handleDequeue}
                  disabled={isAnimating || isProcessing || queue.length === 0}
                  className={`px-5 py-2.5 rounded-lg text-white text-sm font-bold transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${isProcessing ? "bg-orange-600 animate-pulse" : "bg-green-600 hover:bg-green-500"}`}
                >
                  {isProcessing ? "⚙️ Processing..." : "← Process FRONT"}
                </button>
                {queue.length === 0 && !isProcessing && (
                  <span className="text-red-400 text-xs font-bold">
                    Queue Empty!
                  </span>
                )}
                {frontTicket && !isProcessing && (
                  <span className="text-white/50 text-xs">
                    Next:{" "}
                    <span className="text-green-300 font-bold">
                      {frontTicket.icon} {frontTicket.type}
                    </span>
                  </span>
                )}
              </div>
              {/* Processing bar */}
              {isProcessing && (
                <div className="flex flex-col gap-1">
                  <p className="text-orange-300 text-xs">
                    Serving {frontTicket?.type}...
                  </p>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 rounded-full animate-[grow_1.2s_ease-in-out_forwards]"
                      style={{
                        width: "100%",
                        animation: "none",
                        transition: "width 1.2s linear",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Peek */}
          {activeTab === "peek" && (
            <div className="flex flex-col gap-3">
              <p className="text-white/50 text-xs">
                View FRONT ticket without processing —{" "}
                <span className="text-green-400 font-bold">O(1)</span>
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={handlePeek}
                  disabled={queue.length === 0}
                  className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-bold transition-all"
                >
                  👁️ Peek FRONT
                </button>
                {frontTicket && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-violet-400/15 border border-violet-400/40 rounded-lg">
                    <span className="text-2xl">{frontTicket.icon}</span>
                    <div>
                      <p className="text-violet-300 text-xs font-bold">
                        FRONT [0] — {frontTicket.num}
                      </p>
                      <p className="text-white/70 text-xs">
                        {frontTicket.type}
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
                ["Enqueue (rear)", "O(1)", true],
                ["Dequeue (front)", "O(1)", true],
                ["Peek front", "O(1)", true],
                ["isEmpty check", "O(1)", true],
                ["Search by value", "O(n)", false],
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

            {/* Live state */}
            <div className="mt-3 px-3 py-2 bg-violet-400/10 border border-violet-400/25 rounded-lg">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {[
                  [
                    "isEmpty",
                    queue.length === 0 ? "true" : "false",
                    queue.length === 0,
                  ],
                  [
                    "isFull",
                    queue.length >= MAX_QUEUE ? "true" : "false",
                    queue.length >= MAX_QUEUE,
                  ],
                  ["size", String(queue.length), false],
                  [
                    "front",
                    frontTicket ? `"${frontTicket.type}"` : "null",
                    false,
                  ],
                  [
                    "rear",
                    rearTicket && queue.length > 1
                      ? `"${rearTicket.type}"`
                      : frontTicket
                        ? `"${frontTicket.type}"`
                        : "null",
                    false,
                  ],
                  ["status", isProcessing ? "SERVING" : "IDLE", false],
                ].map(([k, v, isWarn]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-white/50">{k}:</span>
                    <span
                      className={`font-bold ${
                        isWarn
                          ? "text-red-400"
                          : v === "SERVING"
                            ? "text-orange-400"
                            : "text-violet-300"
                      }`}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-white/25 text-xs pb-2">
        💡 Tickets join REAR → processed at FRONT window · Drag to rotate ·
        Scroll to zoom
      </p>
    </div>
  );
}
