const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ARENA_WIDTH = 900;
const ARENA_HEIGHT = 600;
const PLAYER_RADIUS = 18;
const STAR_RADIUS = 14;
const STAR_COUNT = 10;
const ROUND_DURATION = 60;
const ROUND_END_DELAY = 5000;
const GAMESTATE_BROADCAST_INTERVAL = 50;
const MAX_PLAYERS = 4;
const COLORS = ["#2dd4bf", "#f97316", "#60a5fa", "#f472b6"];

const players = {};
let stars = [];
let timeLeft = ROUND_DURATION;
let roundActive = true;
let roundEndsAt = Date.now() + ROUND_DURATION * 1000;
let nextColorIndex = 0;
let shuttingDown = false;
let gameStateDirty = true;

function sanitizeNickname(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[&<>"]/g, "")
    .trim()
    .slice(0, 12);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPosition(radius) {
  return {
    x: randomBetween(radius, ARENA_WIDTH - radius),
    y: randomBetween(radius, ARENA_HEIGHT - radius),
  };
}

function createStar() {
  const position = randomPosition(STAR_RADIUS + 8);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x: position.x,
    y: position.y,
  };
}

function refillStars() {
  stars = [];
  for (let index = 0; index < STAR_COUNT; index += 1) {
    stars.push(createStar());
  }
}

function getScores() {
  return Object.values(players)
    .map((player) => ({
      id: player.id,
      nickname: player.nickname,
      score: player.score,
      color: player.color,
    }))
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
}

function getWinners() {
  const scores = getScores();
  if (!scores.length) {
    return [];
  }

  const topScore = scores[0].score;
  return scores.filter((player) => player.score === topScore);
}

function getGameState() {
  return {
    arena: {
      width: ARENA_WIDTH,
      height: ARENA_HEIGHT,
    },
    players,
    stars,
    scores: getScores(),
    timeLeft,
    roundActive,
    winners: roundActive ? [] : getWinners(),
  };
}

function emitGameState() {
  io.emit("gameState", getGameState());
}

function markGameStateDirty() {
  gameStateDirty = true;
}

function resetRound() {
  timeLeft = ROUND_DURATION;
  roundActive = true;
  roundEndsAt = Date.now() + ROUND_DURATION * 1000;
  refillStars();

  Object.values(players).forEach((player) => {
    player.score = 0;
    const position = randomPosition(PLAYER_RADIUS + 4);
    player.x = position.x;
    player.y = position.y;
  });

  markGameStateDirty();
}

function endRound() {
  if (!roundActive) {
    return;
  }

  roundActive = false;
  timeLeft = 0;
  markGameStateDirty();
  setTimeout(resetRound, ROUND_END_DELAY);
}

function tryCollectStar(player) {
  let collected = false;

  stars = stars.map((star) => {
    const dx = player.x - star.x;
    const dy = player.y - star.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= PLAYER_RADIUS + STAR_RADIUS) {
      collected = true;
      player.score += 1;
      io.to(player.id).emit("starCollected", {
        x: player.x,
        y: player.y,
        score: player.score,
      });
      return createStar();
    }

    return star;
  });

  return collected;
}

setInterval(() => {
  if (gameStateDirty) {
    gameStateDirty = false;
    emitGameState();
  }
}, GAMESTATE_BROADCAST_INTERVAL);

setInterval(() => {
  if (!roundActive) {
    return;
  }

  const remainingMs = roundEndsAt - Date.now();
  const nextTimeLeft = Math.max(0, Math.ceil(remainingMs / 1000));

  if (nextTimeLeft !== timeLeft) {
    timeLeft = nextTimeLeft;
    markGameStateDirty();
  }

  if (remainingMs <= 0) {
    endRound();
  }
}, 250);

io.on("connection", (socket) => {
  if (shuttingDown) {
    socket.disconnect(true);
    return;
  }

  socket.on("joinGame", (payload = {}, callback) => {
    const nickname = sanitizeNickname(payload.nickname);

    if (!nickname) {
      callback?.({ ok: false, message: "Digite um apelido valido." });
      return;
    }

    if (players[socket.id]) {
      callback?.({ ok: true });
      return;
    }

    if (Object.keys(players).length >= MAX_PLAYERS) {
      callback?.({ ok: false, message: "A arena ja esta cheia." });
      return;
    }

    const position = randomPosition(PLAYER_RADIUS + 4);
    const color = COLORS[nextColorIndex % COLORS.length];
    nextColorIndex += 1;

    players[socket.id] = {
      id: socket.id,
      nickname,
      x: position.x,
      y: position.y,
      color,
      score: 0,
    };

    callback?.({ ok: true, playerId: socket.id });
    socket.emit("gameState", getGameState());
    markGameStateDirty();
  });

  socket.on("playerMove", (payload = {}) => {
    if (!roundActive) {
      return;
    }

    const player = players[socket.id];
    if (!player) {
      return;
    }

    const nextX = Number(payload.x);
    const nextY = Number(payload.y);

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      return;
    }

    player.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, nextX));
    player.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, nextY));

    tryCollectStar(player);
    markGameStateDirty();
  });

  socket.on("disconnect", () => {
    if (!players[socket.id]) {
      return;
    }

    delete players[socket.id];
    markGameStateDirty();
  });
});

refillStars();
markGameStateDirty();

app.get("/health", (_request, response) => {
  response.status(200).json({
    ok: true,
    players: Object.keys(players).length,
    roundActive,
    timeLeft,
  });
});

app.use(express.static(path.join(__dirname, "public")));

server.listen(PORT, () => {
  console.log(`Star Rush rodando em http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  io.emit("serverRestarting");

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(0);
  }, 10000).unref();
});
