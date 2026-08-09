const socket = io();

const joinScreen = document.getElementById("join-screen");
const gameScreen = document.getElementById("game-screen");
const nicknameInput = document.getElementById("nickname");
const playButton = document.getElementById("play-button");
const joinMessage = document.getElementById("join-message");
const timerElement = document.getElementById("timer");
const scoreList = document.getElementById("score-list");
const scoreHint = document.getElementById("score-hint");
const winnerBanner = document.getElementById("winner-banner");
const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");
const controlButtons = document.querySelectorAll(".control-button");

const state = {
  playerId: null,
  joined: false,
  roundActive: true,
  arena: { width: canvas.width, height: canvas.height },
  players: {},
  stars: [],
  scores: [],
  timeLeft: 60,
  effects: [],
  keys: {},
  localPlayer: null,
  lastSentAt: 0,
};

const PLAYER_SPEED = 4;
const SERVER_SYNC_INTERVAL = 50;
const SNAP_DISTANCE = 28;
const MOBILE_HINT = "Segure os botoes para mover no celular. Teclado continua funcionando no desktop.";
const DESKTOP_HINT = "Use WASD ou as setas para correr pela arena.";

function sanitizeNickname(value) {
  return value.replace(/[<>]/g, "").trim().slice(0, 12);
}

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function setJoinMessage(message, isError = true) {
  joinMessage.textContent = message;
  joinMessage.style.color = isError ? "var(--danger)" : "var(--success)";
}

function updateScoreboard() {
  scoreList.innerHTML = "";

  state.scores.forEach((player) => {
    const item = document.createElement("div");
    item.className = "score-item";

    const name = document.createElement("div");
    name.className = "score-name";

    const dot = document.createElement("span");
    dot.className = "score-dot";
    dot.style.background = player.color;

    const label = document.createElement("span");
    label.className = "score-player";
    label.textContent = player.nickname;

    const score = document.createElement("span");
    score.className = "score-value";
    score.textContent = `${player.score}`;

    name.append(dot, label);
    item.append(name, score);
    scoreList.appendChild(item);
  });
}

function showWinner(winners) {
  if (!winners.length) {
    winnerBanner.textContent = "Sem vencedor desta vez!";
  } else if (winners.length === 1) {
    winnerBanner.innerHTML = `${winners[0].nickname.toUpperCase()} VENCEU!<br>Pontuacao: ${winners[0].score}`;
  } else {
    const names = winners.map((winner) => winner.nickname.toUpperCase()).join(" e ");
    winnerBanner.innerHTML = `EMPATE!<br>${names}<br>${winners[0].score} pontos`;
  }

  winnerBanner.classList.remove("hidden");
}

function hideWinner() {
  winnerBanner.classList.add("hidden");
}

function addEffect(x, y) {
  state.effects.push({
    x,
    y,
    text: "+1 *",
    createdAt: performance.now(),
  });
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#1a567d");
  gradient.addColorStop(1, "#23a36d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 6;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  for (let index = 0; index < 8; index += 1) {
    const x = 80 + index * 100;
    context.fillStyle = "rgba(255, 255, 255, 0.05)";
    context.beginPath();
    context.arc(x, 90 + (index % 2) * 160, 28, 0, Math.PI * 2);
    context.fill();
  }
}

function drawStar(star) {
  context.save();
  context.translate(star.x, star.y);
  context.fillStyle = "#ffd54f";
  context.strokeStyle = "#fff4b5";
  context.lineWidth = 2;
  context.beginPath();

  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 14 : 6;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawPlayer(player) {
  const isCurrentPlayer = player.id === state.playerId;
  const drawX = isCurrentPlayer && state.localPlayer ? state.localPlayer.x : player.x;
  const drawY = isCurrentPlayer && state.localPlayer ? state.localPlayer.y : player.y;

  context.save();
  context.translate(drawX, drawY);

  context.fillStyle = player.color;
  context.shadowColor = `${player.color}99`;
  context.shadowBlur = isCurrentPlayer ? 22 : 12;
  context.beginPath();
  context.arc(0, 0, 18, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = "rgba(255,255,255,0.85)";
  context.beginPath();
  context.arc(-5, -5, 5, 0, Math.PI * 2);
  context.arc(5, -5, 5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#16324b";
  context.beginPath();
  context.arc(-5, -5, 2, 0, Math.PI * 2);
  context.arc(5, -5, 2, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#16324b";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 2, 8, 0.2, Math.PI - 0.2);
  context.stroke();

  context.restore();

  context.fillStyle = "#ffffff";
  context.font = "bold 14px Trebuchet MS";
  context.textAlign = "center";
  context.fillText(player.nickname, drawX, drawY - 28);
}

function drawEffects(now) {
  state.effects = state.effects.filter((effect) => now - effect.createdAt < 700);

  state.effects.forEach((effect) => {
    const progress = (now - effect.createdAt) / 700;
    context.save();
    context.globalAlpha = 1 - progress;
    context.fillStyle = "#fff1a8";
    context.font = "bold 20px Trebuchet MS";
    context.textAlign = "center";
    context.fillText(effect.text, effect.x, effect.y - progress * 32);
    context.restore();
  });
}

function render(now = performance.now()) {
  drawBackground();
  state.stars.forEach(drawStar);
  Object.values(state.players).forEach(drawPlayer);
  drawEffects(now);
  requestAnimationFrame(render);
}

function syncGameState(gameState) {
  state.arena = gameState.arena;
  state.players = gameState.players;
  state.stars = gameState.stars;
  state.scores = gameState.scores;
  state.timeLeft = gameState.timeLeft;
  state.roundActive = gameState.roundActive;

  const serverPlayer = gameState.players[state.playerId];
  if (serverPlayer) {
    if (!state.localPlayer) {
      state.localPlayer = {
        x: serverPlayer.x,
        y: serverPlayer.y,
      };
    } else {
      const dx = serverPlayer.x - state.localPlayer.x;
      const dy = serverPlayer.y - state.localPlayer.y;
      const distance = Math.hypot(dx, dy);

      if (distance > SNAP_DISTANCE) {
        state.localPlayer.x = serverPlayer.x;
        state.localPlayer.y = serverPlayer.y;
      } else {
        state.localPlayer.x += dx * 0.35;
        state.localPlayer.y += dy * 0.35;
      }
    }
  }

  timerElement.textContent = `TEMPO: ${gameState.timeLeft}s`;
  updateScoreboard();

  if (!gameState.roundActive) {
    showWinner(gameState.winners);
  } else {
    hideWinner();
  }
}

function moveCurrentPlayer() {
  if (!state.joined || !state.roundActive) {
    return;
  }

  if (!state.localPlayer) {
    return;
  }

  let dx = 0;
  let dy = 0;

  if (state.keys.ArrowUp || state.keys.KeyW) {
    dy -= PLAYER_SPEED;
  }
  if (state.keys.ArrowDown || state.keys.KeyS) {
    dy += PLAYER_SPEED;
  }
  if (state.keys.ArrowLeft || state.keys.KeyA) {
    dx -= PLAYER_SPEED;
  }
  if (state.keys.ArrowRight || state.keys.KeyD) {
    dx += PLAYER_SPEED;
  }

  if (!dx && !dy) {
    return;
  }

  state.localPlayer.x = Math.max(18, Math.min(state.arena.width - 18, state.localPlayer.x + dx));
  state.localPlayer.y = Math.max(18, Math.min(state.arena.height - 18, state.localPlayer.y + dy));

  const now = performance.now();
  if (now - state.lastSentAt >= SERVER_SYNC_INTERVAL) {
    state.lastSentAt = now;
    socket.emit("playerMove", {
      x: state.localPlayer.x,
      y: state.localPlayer.y,
    });
  }
}

function gameLoop() {
  moveCurrentPlayer();
  requestAnimationFrame(gameLoop);
}

function setControlState(codes, isPressed, button) {
  codes.forEach((code) => {
    state.keys[code] = isPressed;
  });

  if (button) {
    button.classList.toggle("active", isPressed);
  }
}

function bindTouchControls() {
  controlButtons.forEach((button) => {
    const codes = button.dataset.controls.split(",");

    const press = (event) => {
      event.preventDefault();
      setControlState(codes, true, button);
    };

    const release = (event) => {
      event.preventDefault();
      setControlState(codes, false, button);
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

function updateControlHint() {
  scoreHint.textContent = isTouchDevice() ? MOBILE_HINT : DESKTOP_HINT;
}

function shouldHandleMovementKey(event) {
  if (!state.joined) {
    return false;
  }

  if (document.activeElement === nicknameInput) {
    return false;
  }

  return ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code);
}

playButton.addEventListener("click", () => {
  const nickname = sanitizeNickname(nicknameInput.value);

  if (!nickname) {
    setJoinMessage("Digite um apelido com ate 12 caracteres.");
    return;
  }

  playButton.disabled = true;
  setJoinMessage("Entrando na arena...", false);

  socket.emit("joinGame", { nickname }, (response) => {
    playButton.disabled = false;

    if (!response?.ok) {
      setJoinMessage(response?.message || "Nao foi possivel entrar.");
      return;
    }

    state.playerId = response.playerId;
    state.joined = true;
    state.localPlayer = null;
    state.lastSentAt = 0;
    joinScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
  });
});

nicknameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    playButton.click();
  }
});

window.addEventListener("keydown", (event) => {
  if (!shouldHandleMovementKey(event)) {
    return;
  }

  event.preventDefault();
  state.keys[event.code] = true;
});

window.addEventListener("keyup", (event) => {
  if (!shouldHandleMovementKey(event)) {
    return;
  }

  state.keys[event.code] = false;
});

window.addEventListener("blur", () => {
  Object.keys(state.keys).forEach((code) => {
    state.keys[code] = false;
  });
  controlButtons.forEach((button) => button.classList.remove("active"));
});

socket.on("gameState", syncGameState);

socket.on("starCollected", ({ x, y }) => {
  addEffect(x, y);
});

socket.on("disconnect", () => {
  if (!state.joined) {
    return;
  }

  setJoinMessage("Conexao perdida. Recarregue a pagina para voltar ao jogo.");
  joinScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  state.joined = false;
  state.localPlayer = null;
});

bindTouchControls();
updateControlHint();
render();
gameLoop();
