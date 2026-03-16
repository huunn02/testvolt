const { useEffect, useMemo, useRef, useState } = React;

const GRID_SIZE = 5;
const VARIANTS = [
  "empty",
  "straightH",
  "straightV",
  "cornerNE",
  "cornerSE",
  "cornerSW",
  "cornerNW",
  "tUp",
  "tRight",
  "tDown",
  "tLeft",
  "cross",
];

const useCanvasSize = (ref) => {
  const [size, setSize] = useState(520);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.min(entry.contentRect.width, entry.contentRect.height);
        if (next > 0) setSize(next);
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};

const drawWire = (ctx, points, glowColor, intensity = 1) => {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8 * intensity;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
};

const drawNode = (ctx, x, y, radius, color, intensity = 1) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6 * intensity;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawEndpointLabel = (ctx, x, y, size, label) => {
  ctx.save();
  ctx.fillStyle = "#2b2b2b";
  ctx.font = `${Math.max(10, Math.round(size * 0.16))}px "Orbitron", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
  ctx.restore();
};

const drawTile = (ctx, x, y, size, variant, highlight, energized, tilted) => {
  const padding = size * 0.18;
  const center = { x: x + size / 2, y: y + size / 2 };
  const left = { x: x + padding, y: center.y };
  const right = { x: x + size - padding, y: center.y };
  const top = { x: center.x, y: y + padding };
  const bottom = { x: center.x, y: y + size - padding };
  const glowMain = "#6078b9";
  const glowAlt = "#ffffff";
  const energy = "#6f9b7a";
  const intensity = energized ? 1.6 : 1;
  const wireColor = energized ? energy : glowMain;
  const nodeColor = energized ? "#3bffb4" : glowAlt;

  if (highlight) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.01)";
    ctx.fillRect(x, y, size, size);
    ctx.restore();
  }

  if (tilted) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = size * 0.15;
    ctx.shadowOffsetX = size * 0.08;
    ctx.shadowOffsetY = size * 0.12;
    ctx.fillRect(x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.8);
    ctx.restore();
  }

  ctx.lineWidth = size * 0.18;

  switch (variant) {
    case "straightH":
      drawWire(ctx, [left, center, right], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.06, nodeColor, intensity);
      break;
    case "straightV":
      drawWire(ctx, [top, center, bottom], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.06, nodeColor, intensity);
      break;
    case "cornerNE":
      drawWire(ctx, [top, center, right], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.06, nodeColor, intensity);
      break;
    case "cornerSE":
      drawWire(ctx, [right, center, bottom], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.06, nodeColor, intensity);
      break;
    case "cornerSW":
      drawWire(ctx, [bottom, center, left], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.06, nodeColor, intensity);
      break;
    case "cornerNW":
      drawWire(ctx, [left, center, top], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.06, nodeColor, intensity);
      break;
    case "tUp":
      drawWire(ctx, [left, center, right], wireColor, intensity);
      drawWire(ctx, [center, top], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.08, nodeColor, intensity);
      break;
    case "tRight":
      drawWire(ctx, [top, center, bottom], wireColor, intensity);
      drawWire(ctx, [center, right], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.08, nodeColor, intensity);
      break;
    case "tDown":
      drawWire(ctx, [left, center, right], wireColor, intensity);
      drawWire(ctx, [center, bottom], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.08, nodeColor, intensity);
      break;
    case "tLeft":
      drawWire(ctx, [top, center, bottom], wireColor, intensity);
      drawWire(ctx, [center, left], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.08, nodeColor, intensity);
      break;
    case "cross":
      drawWire(ctx, [left, center, right], wireColor, intensity);
      drawWire(ctx, [top, center, bottom], wireColor, intensity);
      drawNode(ctx, center.x, center.y, size * 0.1, nodeColor, intensity);
      break;
    default:
      break;
  }
};

const CONNECTIONS = {
  empty: [],
  straightH: ["L", "R"],
  straightV: ["U", "D"],
  cornerNE: ["U", "R"],
  cornerSE: ["R", "D"],
  cornerSW: ["D", "L"],
  cornerNW: ["L", "U"],
  tUp: ["L", "U", "R"],
  tRight: ["U", "R", "D"],
  tDown: ["L", "R", "D"],
  tLeft: ["U", "L", "D"],
  cross: ["U", "R", "D", "L"],
};

const OPPOSITE = { U: "D", D: "U", L: "R", R: "L" };

const neighborIndex = (index, dir, gridSize) => {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  if (dir === "U" && row > 0) return index - gridSize;
  if (dir === "D" && row < gridSize - 1) return index + gridSize;
  if (dir === "L" && col > 0) return index - 1;
  if (dir === "R" && col < gridSize - 1) return index + 1;
  return null;
};

const computeFlowOrder = (grid, startIndex, endIndex, gridSize) => {
  const visited = new Set();
  const order = [];
  const queue = [startIndex];
  visited.add(startIndex);

  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    const variant = VARIANTS[grid[current]];
    const exits =
      current === startIndex ? ["U", "R", "D", "L"] : CONNECTIONS[variant] || [];

    exits.forEach((dir) => {
      const next = neighborIndex(current, dir, gridSize);
      if (next === null || visited.has(next)) return;
      if (next === endIndex) {
        visited.add(next);
        queue.push(next);
        return;
      }
      const nextVariant = VARIANTS[grid[next]];
      const nextExits = CONNECTIONS[nextVariant] || [];
      if (!nextExits.includes(OPPOSITE[dir])) return;
      visited.add(next);
      queue.push(next);
    });
  }

  return order;
};

const END_INDEX = GRID_SIZE * GRID_SIZE - 1;
const ENERGY_STEP = 20; // GO 비용
const ENERGY_PER_TILE = 3; // 타일 이동당 소모
const ENERGY_PER_PLACEMENT = 2; // 배치 비용
const ENERGY_PER_REFRESH = 3; // 트레이 새로고침 비용

const connectionsForIndex = (grid, index, startIndex, endIndex) => {
  if (index === startIndex || index === endIndex) {
    return ["U", "R", "D", "L"];
  }
  const variant = VARIANTS[grid[index]];
  return CONNECTIONS[variant] || [];
};

const computeConnectedTiles = (grid, startIndex, endIndex, gridSize) => {
  const connected = new Set();
  for (let index = 0; index < grid.length; index += 1) {
    const dirs = connectionsForIndex(grid, index, startIndex, endIndex);
    dirs.forEach((dir) => {
      const neighbor = neighborIndex(index, dir, gridSize);
      if (neighbor === null) return;
      const neighborDirs = connectionsForIndex(grid, neighbor, startIndex, endIndex);
      if (neighborDirs.includes(OPPOSITE[dir])) {
        connected.add(index);
        connected.add(neighbor);
      }
    });
  }
  return connected;
};

const indexToCoord = (index, gridSize) => ({
  row: Math.floor(index / gridSize),
  col: index % gridSize,
});

const manhattan = (a, b) =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

const randomFarPositions = (rng, gridSize) => {
  const maxIndex = gridSize * gridSize;
  const minDistance = Math.max(4, gridSize + 1);
  let start = 0;
  let end = maxIndex - 1;
  let guard = 0;
  while (guard < 200) {
    start = Math.floor(rng() * maxIndex);
    end = Math.floor(rng() * maxIndex);
    if (start === end) {
      guard += 1;
      continue;
    }
    const dist = manhattan(indexToCoord(start, gridSize), indexToCoord(end, gridSize));
    if (dist >= minDistance) break;
    guard += 1;
  }
  if (start === end) {
    start = 0;
    end = maxIndex - 1;
  }
  return { start, end };
};

const PaletteItem = ({ variantIndex, active, onPick }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = 64;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawTile(
      ctx,
      0,
      0,
      size,
      VARIANTS[variantIndex],
      false,
      false,
      false
    );
  }, [variantIndex]);

  return (
    <div
      className={`tile-card${active ? " dragging" : ""}`}
      onPointerDown={(event) => onPick(event, variantIndex)}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

const DragGhost = ({ variantIndex, position }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (variantIndex === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = 72;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawTile(ctx, 0, 0, size, VARIANTS[variantIndex], false, false, false);
  }, [variantIndex]);

  if (variantIndex === null || !position) return null;

  return (
    <div
      className="drag-ghost"
      style={{ left: position.x, top: position.y }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

const randomPalette = () => {
  const count = 4;
  const picks = [];
  for (let i = 0; i < count; i += 1) {
    picks.push(1 + Math.floor(Math.random() * (VARIANTS.length - 1)));
  }
  return picks;
};

const randomVariant = (rng = Math.random) =>
  1 + Math.floor(rng() * (VARIANTS.length - 1));


const mulberry32 = (seed) => {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const stageDifficulty = (stageNumber) => {
  if (stageNumber <= 10) return "easy";
  if (stageNumber <= 25) return "normal";
  return "hard";
};

const energyForDifficulty = (difficulty) => {
  if (difficulty === "easy") return 100;
  if (difficulty === "normal") return 80;
  return 50;
};

const lockedCountForDifficulty = (difficulty) => {
  if (difficulty === "easy") return 0;
  if (difficulty === "normal") return 1;
  return 2;
};

// 난이도별 그리드 크기
const gridSizeForDifficulty = (difficulty) => {
  if (difficulty === "easy") return 5;
  if (difficulty === "normal") return 6;
  return 7;
};

// 스테이지별 시드로 동일한 배치/시작/종료를 재현
const generateStageLayout = (stageNumber) => {
  const rng = mulberry32(stageNumber * 9973);
  const difficulty = stageDifficulty(stageNumber);
  const gridSize = gridSizeForDifficulty(difficulty);
  const grid = Array(gridSize * gridSize).fill(0);
  const { start, end } = randomFarPositions(rng, gridSize);
  const lockedCount = lockedCountForDifficulty(difficulty);
  const lockedIndices = new Set();

  // 삭제 불가 타일 배치
  while (lockedIndices.size < lockedCount) {
    const pick = Math.floor(rng() * grid.length);
    if (pick === start || pick === end) continue;
    if (lockedIndices.has(pick)) continue;
    lockedIndices.add(pick);
    grid[pick] = randomVariant(rng);
  }

  return {
    grid,
    startIndex: start,
    endIndex: end,
    difficulty,
    gridSize,
    initialEnergy: energyForDifficulty(difficulty),
    lockedIndices: Array.from(lockedIndices),
  };
};

const VoltBridge = ({
  stageNumber,
  initialGrid,
  startIndex,
  endIndex,
  lockedIndices,
  initialEnergy,
  gridSize,
  onComplete,
  onBack,
}) => {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const longPressRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const baseGrid = useMemo(
    () => initialGrid ?? Array(gridSize * gridSize).fill(0),
    [initialGrid, gridSize]
  );
  const lockedSet = useMemo(() => new Set(lockedIndices ?? []), [lockedIndices]);
  const [grid, setGrid] = useState(() => baseGrid);
  const [energized, setEnergized] = useState(() => new Set());
  const [flowing, setFlowing] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [energy, setEnergy] = useState(initialEnergy ?? 100);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [palette, setPalette] = useState(() => randomPalette());
  const [draggingVariant, setDraggingVariant] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [isDragging, setIsDragging] = useState(false); // 클릭/드래그 구분용
  const lastTapRef = useRef(0);
  const size = useCanvasSize(wrapperRef);

  const tileSize = useMemo(() => size / gridSize, [size, gridSize]);
  const connectedTiles = useMemo(
    () => computeConnectedTiles(grid, startIndex, endIndex, gridSize),
    [grid, startIndex, endIndex, gridSize]
  );

  useEffect(() => {
    if (energy > 0 || gameOver) return;
    setFlowing(false);
    setTilted(false);
    setGameOver(true);
  }, [energy, gameOver]);

  const updateHoverFromClient = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setHoverIndex(null);
      return;
    }

    const col = Math.floor((x / rect.width) * gridSize);
    const row = Math.floor((y / rect.height) * gridSize);
    const index = row * gridSize + col;
    setHoverIndex(index);
  };

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.strokeStyle = "rgba(35, 38, 38, 0.12)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridSize; i += 1) {
      const pos = i * tileSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    ctx.restore();

    grid.forEach((value, index) => {
      const variant = VARIANTS[value];
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      drawTile(
        ctx,
        col * tileSize,
        row * tileSize,
        tileSize,
        variant,
        hoverIndex === index,
        energized.has(index),
        tilted
      );
    });
    const startCoord = indexToCoord(startIndex, gridSize);
    const endCoord = indexToCoord(endIndex, gridSize);
    const startCenter = {
      x: startCoord.col * tileSize + tileSize / 2,
      y: startCoord.row * tileSize + tileSize / 2,
    };
    const endCenter = {
      x: endCoord.col * tileSize + tileSize / 2,
      y: endCoord.row * tileSize + tileSize / 2,
    };
    drawNode(ctx, startCenter.x, startCenter.y, tileSize * 0.18, "#6f9b7a", 2);
    drawNode(ctx, endCenter.x, endCenter.y, tileSize * 0.18, "#c9886a", 2);
    drawEndpointLabel(ctx, startCenter.x, startCenter.y, tileSize, "START");
    drawEndpointLabel(ctx, endCenter.x, endCenter.y, tileSize, "END");
  }, [grid, hoverIndex, size, tileSize, energized, tilted, startIndex, endIndex]);

  const handlePointer = (event) => {
    updateHoverFromClient(event.clientX, event.clientY);
    if (draggingVariant !== null) {
      setDragPos({ x: event.clientX, y: event.clientY });
    }
    clearLongPress();
  };

  const handleLongPressStart = (event) => {
    if (flowing || gameOver) return;
    updateHoverFromClient(event.clientX, event.clientY);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor((x / rect.width) * gridSize);
    const row = Math.floor((y / rect.height) * gridSize);
    const pressedIndex =
      x < 0 || y < 0 || x > rect.width || y > rect.height
        ? null
        : row * gridSize + col;
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      if (
        pressedIndex === null ||
        pressedIndex === startIndex ||
        pressedIndex === endIndex ||
        lockedSet.has(pressedIndex)
      ) {
        return;
      }
      setGrid((prev) => {
        const next = [...prev];
        next[pressedIndex] = 0;
        return next;
      });
      setEnergized(new Set());
    }, 450);
  };

  const handleDrop = () => {
    if (draggingVariant === null) return;
    if (!isDragging) {
      setDraggingVariant(null);
      setDraggingIndex(null);
      setDragPos(null);
      setDragStart(null);
      setIsDragging(false);
      return;
    }
    if (
      hoverIndex === null ||
      hoverIndex === startIndex ||
      hoverIndex === endIndex ||
      lockedSet.has(hoverIndex) ||
      gameOver ||
      flowing
    ) {
      setDraggingVariant(null);
      setDraggingIndex(null);
      setDragPos(null);
      setDragStart(null);
      setIsDragging(false);
      return;
    }
    setGrid((prev) => {
      const next = [...prev];
      next[hoverIndex] = draggingVariant;
      return next;
    });
    setEnergy((prev) => Math.max(0, prev - ENERGY_PER_PLACEMENT));
    setDraggingVariant(null);
    setDraggingIndex(null);
    setDragPos(null);
    setDragStart(null);
    setIsDragging(false);
    setEnergized(new Set());
    setPalette((prev) => {
      if (draggingIndex === null) return prev;
      const next = [...prev];
      next[draggingIndex] = randomVariant();
      return next;
    });
  };

  const handlePointerUp = () => {
    clearLongPress();
    handleDrop();
  };

  useEffect(() => {
    const handleWindowUp = () => {
      clearLongPress();
      handleDrop();
    };
    const handleWindowMove = (event) => {
      if (draggingVariant === null) return;
      setDragPos({ x: event.clientX, y: event.clientY });
      updateHoverFromClient(event.clientX, event.clientY);
      if (dragStart) {
        const dx = event.clientX - dragStart.x;
        const dy = event.clientY - dragStart.y;
        if (dx * dx + dy * dy > 25) setIsDragging(true);
      }
    };
    window.addEventListener("pointerup", handleWindowUp);
    window.addEventListener("pointermove", handleWindowMove);
    return () => {
      window.removeEventListener("pointerup", handleWindowUp);
      window.removeEventListener("pointermove", handleWindowMove);
    };
  }, [draggingVariant, hoverIndex, gameOver, flowing]);

  const handleReset = () => {
    setGrid(baseGrid);
    setEnergized(new Set());
    setEnergy(initialEnergy ?? 100);
    setLives(3);
    setGameOver(false);
    setSuccess(false);
    setTilted(false);
    setFlowing(false);
    setPalette(randomPalette());
    setDragPos(null);
    setDraggingVariant(null);
    setDraggingIndex(null);
    setDragStart(null);
    setIsDragging(false);
    clearLongPress();
  };

  const handleRefreshTiles = () => {
    setEnergy((prev) => Math.max(0, prev - ENERGY_PER_REFRESH));
    setPalette(randomPalette());
  };

  const handleDelete = (event) => {
    event.preventDefault();
    if (flowing || gameOver) return;
    if (
      hoverIndex === null ||
      hoverIndex === startIndex ||
      hoverIndex === endIndex ||
      lockedSet.has(hoverIndex)
    )
      return;
    setGrid((prev) => {
      const next = [...prev];
      next[hoverIndex] = 0;
      return next;
    });
    setEnergized(new Set());
  };

  const deleteAtIndex = (index) => {
    if (
      index === null ||
      index === startIndex ||
      index === endIndex ||
      lockedSet.has(index) ||
      flowing ||
      gameOver
    )
      return;
    setGrid((prev) => {
      const next = [...prev];
      next[index] = 0;
      return next;
    });
    setEnergized(new Set());
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    if (delta < 280 && hoverIndex !== null) {
      deleteAtIndex(hoverIndex);
    }
  };

  const handleGo = () => {
    if (flowing || gameOver) return;
    // 경로 계산 후 타일 이동당 에너지 소모
    const order = computeFlowOrder(grid, startIndex, endIndex, gridSize);
    setEnergized(new Set());
    setFlowing(true);
    setTilted(true);
    const energyAfterCost = Math.max(0, energy - ENERGY_STEP);
    setEnergy(energyAfterCost);
    const endStep = order.indexOf(endIndex);
    const targetSteps = endStep >= 0 ? endStep + 1 : order.length;
    let energyRemaining = energyAfterCost;

    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      energyRemaining = Math.max(0, energyRemaining - ENERGY_PER_TILE);
      setEnergy(energyRemaining);
      setEnergized(new Set(order.slice(0, step)));
      if (energyRemaining === 0 && step < targetSteps) {
        clearInterval(timer);
        setFlowing(false);
        setTimeout(() => setTilted(false), 250);
        setLives((prev) => {
          const next = prev - 1;
          if (next <= 0) setGameOver(true);
          return Math.max(0, next);
        });
        return;
      }
      if (step >= targetSteps) {
        clearInterval(timer);
        setFlowing(false);
        setTimeout(() => setTilted(false), 250);
        if (endStep < 0) {
          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) setGameOver(true);
            return Math.max(0, next);
          });
        } else {
          setSuccess(true);
        }
      }
    }, 120);
  };

  return (
    <div className="app">
      <div className="board-stack">
        <div className="top-bar">
          <button className="icon-button" onClick={onBack} aria-label="stages">
            &#x2039;
          </button>
          <button
            className="icon-button subtle"
            onClick={() => setShowHelp(true)}
            aria-label="help"
          >
            &#x24D8;
          </button>
        </div>
        <div className="status-bar">
          <div className="gauge">
            <div className="gauge-label">
              <span>energy</span>
              <span>{energy}%</span>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${energy}%` }}></div>
            </div>
          </div>
          <div className="status-right">
            <div className="lives" aria-label="attempts">
              <span>⚡</span>
              {[0, 1, 2].map((slot) => (
                <span
                  key={slot}
                  className={`life${slot < lives ? " active" : ""}`}
                ></span>
              ))}
            </div>
            <button className="icon-button go-icon" onClick={handleGo} aria-label="go">
              ▶
            </button>
          </div>
        </div>
        <section className={`canvas-shell${tilted ? " isometric" : ""}`}>
          <div className="canvas-inner">
            <div className="canvas-area" ref={wrapperRef}>
              <canvas
                ref={canvasRef}
                onPointerMove={handlePointer}
                onPointerLeave={() => setHoverIndex(null)}
                onPointerUp={handlePointerUp}
                onContextMenu={handleDelete}
                onPointerDown={handleLongPressStart}
                onPointerCancel={clearLongPress}
                onPointerOut={clearLongPress}
              />
              <div className="hud"></div>
            </div>
          </div>
        </section>
        <div className="tray">
          <div className="tray-title">available tiles</div>
          <div className="tray-items">
            {palette.map((variantIndex, index) => (
              <PaletteItem
                key={`${variantIndex}-${index}`}
                variantIndex={variantIndex}
                active={draggingIndex === index}
                onPick={(event, pick) => {
                  event.preventDefault();
                  if (flowing || gameOver) return;
                  setDraggingVariant(pick);
                  setDraggingIndex(index);
                  setDragPos({ x: event.clientX, y: event.clientY });
                  setDragStart({ x: event.clientX, y: event.clientY });
                  setIsDragging(false);
                }}
              />
            ))}
            <button
              className="tile-card refresh-tile"
              onClick={handleRefreshTiles}
              aria-label="refresh"
            >
              ↻
            </button>
          </div>
          <div className="hint">드래그해서 놓으면 새 랜덤 타일이 등장합니다.</div>
        </div>
        <div className="bottom-bar">
        </div>
      </div>
      {success && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-title">Connected</div>
            <p className="modal-text">전류가 목표 노드에 도달했습니다.</p>
            <button
              className="button primary"
              onClick={() => {
                setSuccess(false);
                onComplete?.(stageNumber);
              }}
            >
              continue
            </button>
          </div>
        </div>
      )}
      {gameOver && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-title">Game Over</div>
            <p className="modal-text">전류를 3번 연결하지 못했습니다.</p>
            <button className="button primary" onClick={handleReset}>
              retry
            </button>
          </div>
        </div>
      )}
      {showHelp && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-title">How To Play</div>
            <p className="modal-text">
              아래 타일을 드래그해 배치합니다. 시작점과 종료점을 연결하세요.
            </p>
            <p className="modal-text">
              Start에서 End까지 연결 후 GO를 누르세요. 길게 눌러 삭제합니다.
            </p>
            <button className="button primary" onClick={() => setShowHelp(false)}>
              close
            </button>
          </div>
        </div>
      )}
      <DragGhost variantIndex={draggingVariant} position={dragPos} />
    </div>
  );
};

const StageSelect = ({ progress, selectedStage, onPick, onStart, onUnlock }) => {
  const stages = useMemo(() => Array.from({ length: 40 }, (_, i) => i + 1), []);
    const startLocked = selectedStage > progress;

    return (
      <div className="screen panel stage-select">
        <h2 className="title stage-title">Stage Select</h2>
        <p className="subtitle stage-subtitle">현재 스테이지 : #{selectedStage}</p>
        <div className="stage-grid">
          {stages.map((stage) => {
          const locked = stage > progress;
          return (
            <button
              key={stage}
              className={`stage-card${locked ? " locked" : ""}${
                stage === selectedStage ? " active" : ""
              }`}
              onClick={() => onPick(stage)}
            >
              <span>#{stage}</span>
              {locked ? <span className="lock">locked</span> : <span>open</span>}
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button className="button primary" onClick={onStart} disabled={startLocked}>
          start
        </button>
        <button className="button secondary" onClick={onUnlock}>
          unlock
        </button>
      </div>
    </div>
  );
};

const App = () => {
  const [screen, setScreen] = useState("stage");
  const [progress, setProgress] = useState(1);
  const [currentStage, setCurrentStage] = useState(1);
  const [selectedStage, setSelectedStage] = useState(1);
  const layout = useMemo(() => generateStageLayout(currentStage), [currentStage]);

  if (screen === "stage") {
    return (
      <StageSelect
        progress={progress}
        selectedStage={selectedStage}
        onPick={(stage) => {
          setSelectedStage(stage);
        }}
        onStart={() => {
          setCurrentStage(selectedStage);
          setScreen("game");
        }}
        onUnlock={() => {
          setProgress((prev) => Math.max(prev, selectedStage));
        }}
      />
    );
  }

  return (
    <VoltBridge
      key={currentStage}
      stageNumber={currentStage}
      initialGrid={layout.grid}
      startIndex={layout.startIndex}
      endIndex={layout.endIndex}
      lockedIndices={layout.lockedIndices}
      initialEnergy={layout.initialEnergy}
      gridSize={layout.gridSize}
      onBack={() => setScreen("stage")}
      onComplete={(stage) => {
        setProgress((prev) => Math.max(prev, stage));
        const nextStage = Math.min(stage + 1, 500);
        setSelectedStage(nextStage);
        setScreen("stage");
      }}
    />
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
