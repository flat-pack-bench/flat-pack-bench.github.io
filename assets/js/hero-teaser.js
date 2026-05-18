import * as THREE from "./three.module.js";

const host = document.querySelector("#hero-teaser-scene");

if (host) {
  initHeroTeaser(host);
}

function initHeroTeaser(container) {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssColor = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;
  const colors = {
    ink: cssColor("--ink", "#17201d"),
    muted: cssColor("--muted", "#64716b"),
    paper: cssColor("--paper", "#f7f2e8"),
    paperStrong: cssColor("--paper-strong", "#fffaf0"),
    line: cssColor("--line", "#d7c9b0"),
    lineStrong: cssColor("--line-strong", "#a78f67"),
    steel: cssColor("--steel", "#213f4f"),
    blueprint: cssColor("--blueprint", "#0e4b5f"),
    orange: cssColor("--orange", "#c96f2d"),
    green: cssColor("--green", "#5f7c3b"),
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(2.65, 1.82, 4.45);
  camera.lookAt(0.08, 1.16, 0.18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOOP_DURATION = 11.3;
  const SETUP_FADE_START = 1;
  const SETUP_FADE_END = 1.4;
  const OUTRO_START = 8.53;
  const OUTRO_END = 9.5;
  const INTRO_LOOK_BACK_START = 0.16;
  const INTRO_LOOK_BACK_END = 1;
  const THOUGHT_APPEAR_START = 0.08;
  const THOUGHT_CLEAR_START = 9.53;
  const MONITOR_X = 0.24;
  const MONITOR_Z = 0.08;

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 1024;
  screenCanvas.height = 576;
  const screenCtx = screenCanvas.getContext("2d");
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = 8;

  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.width = 768;
  bubbleCanvas.height = 384;
  const bubbleCtx = bubbleCanvas.getContext("2d");
  const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas);
  bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  bubbleTexture.anisotropy = 8;

  const materials = {
    deskTop: new THREE.MeshStandardMaterial({ color: colors.orange, roughness: 0.68, metalness: 0.02 }),
    monitorFrame: new THREE.MeshStandardMaterial({ color: colors.steel, roughness: 0.5, metalness: 0.18 }),
    monitorDark: new THREE.MeshStandardMaterial({ color: colors.ink, roughness: 0.45, metalness: 0.16 }),
    robotBody: new THREE.MeshStandardMaterial({ color: colors.paperStrong, roughness: 0.58, metalness: 0.04 }),
    robotSide: new THREE.MeshStandardMaterial({ color: colors.line, roughness: 0.58, metalness: 0.06 }),
    robotJoint: new THREE.MeshStandardMaterial({ color: colors.steel, roughness: 0.42, metalness: 0.32 }),
    robotTrim: new THREE.MeshStandardMaterial({
      color: colors.blueprint,
      roughness: 0.42,
      metalness: 0.06,
      emissive: colors.blueprint,
      emissiveIntensity: 0.08,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: "#e6ffff",
      emissive: "#7be7ea",
      emissiveIntensity: 1.15,
      roughness: 0.18,
    }),
    screen: new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
    thought: new THREE.MeshBasicMaterial({ map: bubbleTexture, transparent: true, toneMapped: false, depthWrite: false }),
    shadow: new THREE.ShadowMaterial({ color: colors.ink, opacity: 0.16 }),
  };

  function makeMesh(geometry, material, position, rotation) {
    const item = new THREE.Mesh(geometry, material);
    item.position.copy(position || new THREE.Vector3());
    if (rotation) item.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    item.castShadow = true;
    item.receiveShadow = true;
    return item;
  }

  function addSurface() {
    const shadow = makeMesh(
      new THREE.PlaneGeometry(4.8, 2.35),
      materials.shadow,
      new THREE.Vector3(0.42, 0.02, 0.3),
      { x: -Math.PI / 2 },
    );
    shadow.castShadow = false;
    scene.add(shadow);

    const desk = makeMesh(
      new THREE.BoxGeometry(2.55, 0.12, 1.05),
      materials.deskTop,
      new THREE.Vector3(0.28, 0.58, 0.34),
    );
    scene.add(desk);

  }

  function addMonitor() {
    const group = new THREE.Group();
    group.position.set(MONITOR_X, 1.32, MONITOR_Z);
    group.rotation.y = -0.13;

    group.add(makeMesh(new THREE.BoxGeometry(2.22, 1.34, 0.12), materials.monitorDark, new THREE.Vector3(0, 0, -0.04)));

    const screen = makeMesh(new THREE.PlaneGeometry(1.9, 1.068), materials.screen, new THREE.Vector3(0, 0, 0.035));
    screen.castShadow = false;
    screen.receiveShadow = false;
    group.add(screen);

    [
      [2.22, 0.12, 0.16, 0, 0.61, 0.03],
      [2.22, 0.12, 0.16, 0, -0.61, 0.03],
      [0.13, 1.34, 0.16, -1.05, 0, 0.03],
      [0.13, 1.34, 0.16, 1.05, 0, 0.03],
    ].forEach(([w, h, d, x, y, z]) => {
      group.add(makeMesh(new THREE.BoxGeometry(w, h, d), materials.monitorFrame, new THREE.Vector3(x, y, z)));
    });

    scene.add(group);
    return group;
  }

  function addRobot() {
    const robot = new THREE.Group();
    robot.position.set(-0.6, 0.56, 1.03);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.78, 0.02);
    robot.add(headGroup);

    const head = makeMesh(new THREE.BoxGeometry(0.72, 0.48, 0.52), materials.robotBody, new THREE.Vector3(0, 0, 0));
    headGroup.add(head);

    const visor = makeMesh(new THREE.BoxGeometry(0.49, 0.16, 0.035), materials.robotTrim, new THREE.Vector3(0, 0.03, 0.282));
    visor.castShadow = false;
    headGroup.add(visor);

    const eyeGeometry = new THREE.SphereGeometry(0.055, 24, 16);
    const leftEye = makeMesh(eyeGeometry, materials.eye, new THREE.Vector3(-0.15, 0.04, 0.308));
    const rightEye = makeMesh(eyeGeometry, materials.eye, new THREE.Vector3(0.15, 0.04, 0.308));
    leftEye.castShadow = false;
    rightEye.castShadow = false;
    headGroup.add(leftEye, rightEye);

    const sideGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24);
    headGroup.add(makeMesh(sideGeometry, materials.robotSide, new THREE.Vector3(-0.39, 0, 0), { z: Math.PI / 2 }));
    headGroup.add(makeMesh(sideGeometry, materials.robotSide, new THREE.Vector3(0.39, 0, 0), { z: Math.PI / 2 }));

    const antenna = makeMesh(new THREE.CylinderGeometry(0.012, 0.016, 0.25, 12), materials.robotJoint, new THREE.Vector3(0, 0.36, 0));
    headGroup.add(antenna);

    const antennaTip = makeMesh(new THREE.SphereGeometry(0.052, 22, 14), materials.eye, new THREE.Vector3(0, 0.51, 0));
    antennaTip.castShadow = false;
    headGroup.add(antennaTip);

    const monitorYaw = Math.atan2(MONITOR_X - robot.position.x, MONITOR_Z - robot.position.z);
    const viewerYaw = Math.atan2(camera.position.x - robot.position.x, camera.position.z - robot.position.z);
    robot.rotation.y = monitorYaw;
    scene.add(robot);

    return { group: robot, headGroup, leftEye, rightEye, antennaTip, monitorYaw, viewerYaw };
  }

  function addThoughtBubble() {
    const group = new THREE.Group();
    group.position.set(0.34, 1.92, 0.9);

    const bubble = makeMesh(new THREE.PlaneGeometry(1.28, 0.64), materials.thought, new THREE.Vector3(0, 0, 0));
    bubble.castShadow = false;
    bubble.receiveShadow = false;
    group.add(bubble);

    scene.add(group);
    return group;
  }

  function addLighting() {
    scene.add(new THREE.HemisphereLight(colors.paperStrong, "#ad7c48", 1.05));

    const key = new THREE.DirectionalLight(colors.paperStrong, 1.6);
    key.position.set(-2.2, 4.3, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.left = -3.5;
    key.shadow.camera.right = 3.5;
    key.shadow.camera.top = 3.2;
    key.shadow.camera.bottom = -1.2;
    scene.add(key);

    const screenLight = new THREE.PointLight("#86dbe4", 0.9, 3.8, 1.8);
    screenLight.position.set(0.1, 1.28, 0.82);
    scene.add(screenLight);
    return { screenLight };
  }

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function easeInOut(t) {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  }

  function easeOutBack(t) {
    t = clamp(t);
    const c1 = 1.22;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawPlank(ctx, x, y, width, height, rotation, alpha, time, variant = "light") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;

    const woodPalettes = {
      red: ["#b31b1b", "#f06b55", "#6f1111"],
      blue: ["#0e4b5f", "#4aa6c2", "#082b36"],
      green: ["#5f7c3b", "#9fbd63", "#31451d"],
    };
    const palette = woodPalettes[variant] || woodPalettes.red;
    const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.45, palette[1]);
    gradient.addColorStop(1, palette[2]);

    ctx.shadowColor = "rgba(43, 35, 22, 0.28)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;
    roundedRect(ctx, -width / 2, -height / 2, width, height, Math.max(5, Math.min(12, height / 3)));
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1.5, height * 0.055);
    ctx.strokeStyle = "rgba(255, 250, 240, 0.42)";
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.35;
    ctx.lineWidth = Math.max(1, height * 0.035);
    ctx.strokeStyle = "rgba(68, 38, 20, 0.75)";
    const grainCount = Math.max(2, Math.floor(height / 17));
    for (let i = 0; i < grainCount; i += 1) {
      const gy = -height / 2 + 10 + i * 16 + Math.sin(time * 2 + i + width * 0.02) * 1.6;
      ctx.beginPath();
      ctx.moveTo(-width / 2 + 8, gy);
      ctx.bezierCurveTo(-width / 5, gy - 4, width / 6, gy + 4, width / 2 - 8, gy - 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  const letterParts = [
    { key: "stem", start: 1.4, end: 2.36, final: [-120, 0, 56, 288, 0], intro: [-310, 150, -0.5], variant: "red" },
    { key: "top", start: 1.72, end: 2.67, final: [-2, -116, 228, 56, 0], intro: [270, -215, 0.44], variant: "red" },
    { key: "middle", start: 2.04, end: 2.96, final: [-10, -14, 178, 54, 0], intro: [300, 116, -0.62], variant: "red" },
    { key: "p-right", start: 3.93, end: 4.95, final: [108, -64, 56, 154, 0], intro: [315, -28, 0.68], variant: "green" },
    { key: "b-right", start: 5.87, end: 6.91, final: [108, 78, 56, 150, 0], intro: [310, 220, -0.58], variant: "blue" },
    { key: "bottom", start: 6.25, end: 7.27, final: [-2, 128, 228, 56, 0], intro: [-305, 244, 0.5], variant: "blue" },
  ];

  function partTransform(part, t) {
    const [fx, fy, fw, fh, fr] = part.final;
    const [ix, iy, ir] = part.intro;
    if (t < SETUP_FADE_END) {
      const setupAlpha = easeInOut((t - SETUP_FADE_START) / (SETUP_FADE_END - SETUP_FADE_START));
      return { x: ix, y: iy, width: fw, height: fh, rotation: ir, alpha: 0.64 * setupAlpha };
    }

    if (t >= OUTRO_START) {
      if (t >= OUTRO_END) {
        return { x: fx, y: fy, width: fw, height: fh, rotation: fr, alpha: 0 };
      }

      const p = easeInOut((t - OUTRO_START) / (OUTRO_END - OUTRO_START));
      const ox = part.key === "bottom" ? -260 : part.key.includes("right") ? 280 : part.key === "top" ? 255 : -235;
      const oy = part.key === "top" ? -220 : 220;
      return { x: lerp(fx, ox, p), y: lerp(fy, oy, p), width: fw, height: fh, rotation: lerp(fr, 0.55, p), alpha: 1 - p };
    }

    if (t < part.start) {
      return { x: ix, y: iy, width: fw, height: fh, rotation: ir, alpha: 0.64 };
    }

    const p = easeOutBack((t - part.start) / (part.end - part.start));
    return {
      x: lerp(ix, fx, p),
      y: lerp(iy, fy, p),
      width: fw,
      height: fh,
      rotation: lerp(ir, fr, p),
      alpha: lerp(0.64, 1, easeInOut((t - part.start) / 0.32)),
    };
  }

  function drawArrow(ctx, x1, y1, x2, y2, alpha) {
    if (alpha <= 0.01) return;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors.blueprint;
    ctx.fillStyle = colors.blueprint;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-22, -13);
    ctx.lineTo(-22, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMiniLetter(ctx, letter, centerX, centerY, scale, alpha, active, timeSeconds) {
    if (alpha <= 0.01) return;
    const pulse = active ? 1 + Math.sin(timeSeconds * 4.2) * 0.022 : 1;
    const s = scale * pulse;
    const pieces = [
      [-120, 0, 56, 288, 0, "red"],
      [-2, -116, 228, 56, 0, "red"],
      [-10, -14, 178, 54, 0, "red"],
    ];

    if (letter === "P" || letter === "B") pieces.push([108, -64, 56, 154, 0, "green"]);
    if (letter === "B") {
      pieces.push([108, 78, 56, 150, 0, "blue"]);
      pieces.push([-2, 128, 228, 56, 0, "blue"]);
    }

    pieces.forEach(([x, y, width, height, rotation, variant], index) => {
      drawPlank(ctx, centerX + x * s, centerY + y * s, width * s, height * s, rotation, alpha, timeSeconds + index * 0.4, variant);
    });
  }

  function cloudBubblePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(150, 222);
    ctx.bezierCurveTo(106, 222, 80, 194, 94, 158);
    ctx.bezierCurveTo(74, 122, 104, 84, 154, 86);
    ctx.bezierCurveTo(170, 48, 232, 42, 260, 72);
    ctx.bezierCurveTo(288, 38, 354, 42, 380, 78);
    ctx.bezierCurveTo(410, 38, 484, 36, 518, 70);
    ctx.bezierCurveTo(552, 38, 628, 48, 642, 92);
    ctx.bezierCurveTo(700, 92, 730, 132, 706, 170);
    ctx.bezierCurveTo(730, 208, 692, 240, 638, 224);
    ctx.bezierCurveTo(584, 252, 508, 250, 458, 224);
    ctx.bezierCurveTo(430, 248, 330, 248, 302, 224);
    ctx.bezierCurveTo(260, 246, 200, 248, 150, 222);
    ctx.closePath();
  }

  function drawWeightedThoughtDot(ctx, x, y, radius, alpha = 1, scale = 1) {
    if (alpha <= 0.01 || scale <= 0.01) return;

    const r = radius * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(43, 35, 22, 0.26)";
    ctx.shadowBlur = 12 * scale;
    ctx.shadowOffsetY = 5 * scale;
    const gradient = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.2, x, y, r);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    gradient.addColorStop(0.62, "rgba(255, 250, 240, 0.98)");
    gradient.addColorStop(1, "rgba(218, 207, 185, 0.98)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.strokeStyle = "rgba(23, 32, 29, 0.22)";
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.strokeStyle = "rgba(14, 75, 95, 0.42)";
    ctx.stroke();
    ctx.restore();
  }

  function drawThoughtBubble(timeSeconds) {
    const t = timeSeconds % LOOP_DURATION;
    bubbleCtx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);

    const thoughtFadeOut = 1 - easeInOut((t - THOUGHT_CLEAR_START) / 0.54);
    const cloudAlpha = easeInOut((t - (THOUGHT_APPEAR_START + 0.52)) / 0.44) * thoughtFadeOut;
    const cloudScale = 0.88 + 0.12 * clamp(easeOutBack((t - (THOUGHT_APPEAR_START + 0.5)) / 0.56), 0, 1.08);
    const contentAlpha = cloudAlpha;
    const fAlpha = easeInOut((t - 3.3) / 0.42) * contentAlpha;
    const pAlpha = easeInOut((t - 5.31) / 0.48) * contentAlpha;
    const bAlpha = easeInOut((t - 7.53) / 0.52) * contentAlpha;
    const arrowOneAlpha = easeInOut((t - 5.25) / 0.44) * contentAlpha;
    const arrowTwoAlpha = easeInOut((t - 7.45) / 0.44) * contentAlpha;

    bubbleCtx.save();
    bubbleCtx.globalAlpha = cloudAlpha;
    bubbleCtx.translate(384, 176);
    bubbleCtx.scale(cloudScale, cloudScale);
    bubbleCtx.translate(-384, -176);
    bubbleCtx.shadowColor = "rgba(43, 35, 22, 0.34)";
    bubbleCtx.shadowBlur = 26;
    bubbleCtx.shadowOffsetY = 12;
    bubbleCtx.fillStyle = colors.paperStrong;
    cloudBubblePath(bubbleCtx);
    bubbleCtx.fill();

    bubbleCtx.shadowColor = "transparent";
    bubbleCtx.strokeStyle = "rgba(23, 32, 29, 0.34)";
    bubbleCtx.lineWidth = 8;
    cloudBubblePath(bubbleCtx);
    bubbleCtx.stroke();
    bubbleCtx.strokeStyle = "rgba(14, 75, 95, 0.58)";
    bubbleCtx.lineWidth = 4;
    cloudBubblePath(bubbleCtx);
    bubbleCtx.stroke();
    bubbleCtx.restore();

    [
      [136, 334, 13, 0],
      [178, 300, 19, 0.2],
      [224, 258, 28, 0.4],
    ].forEach(([x, y, radius, delay]) => {
      const dotScale = 0.2 + 0.8 * clamp(easeOutBack((t - (THOUGHT_APPEAR_START + delay)) / 0.36), 0, 1.12);
      const dotAlpha = easeInOut((t - (THOUGHT_APPEAR_START + delay)) / 0.22) * thoughtFadeOut;
      drawWeightedThoughtDot(bubbleCtx, x, y, radius, dotAlpha, dotScale);
    });

    drawMiniLetter(bubbleCtx, "F", 194, 148, 0.3, fAlpha, t >= 3.3 && t < 5.31, timeSeconds);
    drawMiniLetter(bubbleCtx, "P", 380, 148, 0.3, pAlpha, t >= 5.31 && t < 7.53, timeSeconds);
    drawMiniLetter(bubbleCtx, "B", 566, 148, 0.3, bAlpha, t >= 7.53 && t < THOUGHT_CLEAR_START, timeSeconds);
    drawArrow(bubbleCtx, 250, 146, 314, 146, arrowOneAlpha);
    drawArrow(bubbleCtx, 436, 146, 500, 146, arrowTwoAlpha);

    bubbleTexture.needsUpdate = true;
  }

  function drawScreen(timeSeconds) {
    const width = screenCanvas.width;
    const height = screenCanvas.height;
    const t = timeSeconds % LOOP_DURATION;
    screenCtx.clearRect(0, 0, width, height);

    const bg = screenCtx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#0d3d4d");
    bg.addColorStop(0.46, colors.blueprint);
    bg.addColorStop(1, "#082b36");
    screenCtx.fillStyle = bg;
    screenCtx.fillRect(0, 0, width, height);

    screenCtx.save();
    screenCtx.globalAlpha = 0.18;
    screenCtx.strokeStyle = colors.paperStrong;
    screenCtx.lineWidth = 1;
    const gridOffset = (timeSeconds * 13) % 48;
    for (let x = -48 + gridOffset; x < width + 48; x += 48) {
      screenCtx.beginPath();
      screenCtx.moveTo(x, 0);
      screenCtx.lineTo(x - 80, height);
      screenCtx.stroke();
    }
    for (let y = 0; y < height; y += 42) {
      screenCtx.beginPath();
      screenCtx.moveTo(0, y);
      screenCtx.lineTo(width, y);
      screenCtx.stroke();
    }
    screenCtx.restore();

    const currentStage = t < SETUP_FADE_START || t >= OUTRO_END ? 3 : t < 3.93 ? 0 : t < 5.87 ? 1 : t < OUTRO_START ? 2 : 3;
    const stageColor = currentStage === 0 ? "#8ed7dd" : currentStage === 1 ? "#d8ad3f" : currentStage === 2 ? "#9bb873" : "#cfd8d3";
    const screenContentAlpha = easeInOut((t - SETUP_FADE_START) / 0.36) * (1 - easeInOut((t - OUTRO_END) / 0.48));

    screenCtx.save();
    screenCtx.translate(width / 2, height / 2 + 5);
    screenCtx.globalAlpha = 0.35 * screenContentAlpha;
    screenCtx.strokeStyle = stageColor;
    screenCtx.lineWidth = 4;
    roundedRect(screenCtx, -205, -174, 410, 354, 26);
    screenCtx.stroke();

    letterParts.forEach((part, index) => {
      const transformed = partTransform(part, t);
      if (transformed.alpha <= 0.01) return;
      drawPlank(
        screenCtx,
        transformed.x,
        transformed.y,
        transformed.width,
        transformed.height,
        transformed.rotation,
        transformed.alpha,
        timeSeconds + index,
        part.variant,
      );
    });
    screenCtx.restore();

    screenCtx.save();
    screenCtx.globalAlpha = 0.78 * screenContentAlpha;
    const progress = t / LOOP_DURATION;
    roundedRect(screenCtx, 92, height - 52, width - 184, 8, 4);
    screenCtx.fillStyle = "rgba(255, 250, 240, 0.18)";
    screenCtx.fill();
    roundedRect(screenCtx, 92, height - 52, (width - 184) * progress, 8, 4);
    screenCtx.fillStyle = stageColor;
    screenCtx.fill();
    screenCtx.restore();

    screenTexture.needsUpdate = true;
    return currentStage;
  }

  addSurface();
  const monitor = addMonitor();
  const robot = addRobot();
  const thoughtBubble = addThoughtBubble();
  const lights = addLighting();

  function resize() {
    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function renderFrame() {
    const elapsed = reducedMotion ? 7.35 : clock.getElapsedTime();
    const stage = drawScreen(elapsed);
    drawThoughtBubble(elapsed);

    const cycleTime = elapsed % LOOP_DURATION;
    const turnTowardViewer = easeInOut((cycleTime - 8.11) / 0.44);
    const turnBackToMonitor = easeInOut((cycleTime - OUTRO_END) / 0.9);
    const introGlance = elapsed < INTRO_LOOK_BACK_END
      ? 1 - easeInOut((elapsed - INTRO_LOOK_BACK_START) / (INTRO_LOOK_BACK_END - INTRO_LOOK_BACK_START))
      : 0;
    const glance = Math.max(introGlance, clamp(turnTowardViewer - turnBackToMonitor));
    const watchWobble = Math.sin(elapsed * 0.55) * 0.035;

    robot.group.rotation.y = lerp(robot.monitorYaw + watchWobble, robot.viewerYaw, glance);
    robot.headGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.018;
    robot.headGroup.rotation.x = Math.sin(elapsed * 0.88) * 0.014 - glance * 0.04;
    robot.headGroup.position.y = 0.72 + Math.sin(elapsed * 1.35) * 0.01;
    robot.leftEye.scale.y = Math.sin(elapsed * 2.7) > 0.985 ? 0.28 : 1;
    robot.rightEye.scale.y = robot.leftEye.scale.y;
    robot.antennaTip.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 3.2) * 0.24;

    monitor.rotation.y = -0.13 + Math.sin(elapsed * 0.35) * 0.012;
    thoughtBubble.lookAt(camera.position);
    lights.screenLight.intensity = stage === 1 ? 1.05 : stage === 2 ? 1.18 : 0.92;

    const camSway = Math.sin(elapsed * 0.18) * 0.035;
    camera.position.x = 2.65 + camSway;
    camera.lookAt(0.08, 1.16, 0.18);
    renderer.render(scene, camera);
  }

  function animate() {
    renderFrame();
    if (!reducedMotion) requestAnimationFrame(animate);
  }

  const observer = new ResizeObserver(() => {
    resize();
    renderFrame();
  });
  observer.observe(container);
  resize();
  animate();
}
