
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "auction-data.json");

const INITIAL_POINTS = 250;

const TEAM_NAMES = [
  "Rising Champions",
  "Bajrang Sport",
  "7 Star",
  "Mauli Fabrication Super Kings",
  "Royal Challengers Garlgunji",
  "Shishakti Sport",
  "Sahara Eleven",
  "Sai Sport",
  "Madhyavarti Eleven",
  "Jay Shree Ram Sports",
];

const makeInitialTeams = () =>
  TEAM_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    initialPoints: INITIAL_POINTS,
    remainingPoints: INITIAL_POINTS,
    players: [],
  }));

const makeInitialAuctionState = () => ({
  status: "waiting",
  playerId: "",
  playerName: "",
  playerRole: "",
  role: "",
  playerPhoto: "",
  photoUrl: "",
  image: "",
  photo: "",
  player: null,
  basePrice: 5,
  currentBid: 0,
  highestTeam: "",
  soldTo: "",
  remainingPoints: null,
});

let auctionState = makeInitialAuctionState();
let auctionOverview = {
  teams: makeInitialTeams(),
  history: [],
};

function saveAuctionData() {
  try {
    const temporaryFile = `${DATA_FILE}.tmp`;

    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(
        {
          auctionState,
          auctionOverview,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(temporaryFile, DATA_FILE);
  } catch (error) {
    console.error("Failed to save auction data:", error.message);
  }
}

function loadAuctionData() {
  if (!fs.existsSync(DATA_FILE)) {
    saveAuctionData();
    return;
  }

  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (saved.auctionState && typeof saved.auctionState === "object") {
      auctionState = {
        ...makeInitialAuctionState(),
        ...saved.auctionState,
      };
    }

    if (
      saved.auctionOverview &&
      Array.isArray(saved.auctionOverview.teams) &&
      Array.isArray(saved.auctionOverview.history)
    ) {
      auctionOverview = saved.auctionOverview;
    }

    console.log("Saved auction data restored.");
  } catch (error) {
    console.error("Could not read auction-data.json:", error.message);
    console.error("Check the file before restarting the server.");
  }
}

function broadcastAuction() {
  saveAuctionData();
  io.emit("auction-update", auctionState);
  io.emit("auction-overview", auctionOverview);
}

function resetCurrentPlayer() {
  auctionState = makeInitialAuctionState();
}

function undoLastSale() {
  // History is newest-first in this app.
  const saleIndex = auctionOverview.history.findIndex(
    (item) => item.status === "SOLD"
  );

  if (saleIndex === -1) {
    return {
      ok: false,
      message: "There is no sale to undo.",
    };
  }

  const sale = auctionOverview.history[saleIndex];

  const team = auctionOverview.teams.find(
    (item) => item.name === sale.team
  );

  if (!team) {
    return {
      ok: false,
      message: `Could not find team "${sale.team}". No changes were made.`,
    };
  }

  const amount = Number(sale.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false,
      message: "The recorded sale amount is invalid. No changes were made.",
    };
  }

  const playerIndex = team.players.findIndex((player) =>
    sale.playerId
      ? String(player.id) === String(sale.playerId)
      : player.name === sale.player
  );

  if (playerIndex === -1) {
    return {
      ok: false,
      message:
        "The player was not found in that team's squad. No changes were made.",
    };
  }

  // Refund points and remove the player from the winning team.
  team.remainingPoints = Math.min(
    team.initialPoints,
    Number(team.remainingPoints) + amount
  );

  team.players.splice(playerIndex, 1);

  // Remove only the sale being undone.
  auctionOverview.history.splice(saleIndex, 1);

  // Clear the display if it is still showing this player.
  if (
    String(auctionState.playerId) === String(sale.playerId) ||
    auctionState.playerName === sale.player
  ) {
    resetCurrentPlayer();
  }

  return {
    ok: true,
    message: `Undid the sale of ${sale.player}. ${team.name} received ${amount} points back.`,
  };
}

loadAuctionData();

app.get("/", (_req, res) => {
  res.send("GPL Auction server is running!");
});

app.get("/api/auction", (_req, res) => {
  res.json(auctionState);
});

app.get("/api/overview", (_req, res) => {
  res.json(auctionOverview);
});

io.on("connection", (socket) => {
  console.log("Device connected:", socket.id);

  socket.emit("auction-update", auctionState);
  socket.emit("auction-overview", auctionOverview);

  socket.on("auction-update", (newState) => {
    if (!newState || typeof newState !== "object" || Array.isArray(newState)) {
      return;
    }

    if (!["waiting", "bidding", "sold", "unsold"].includes(newState.status)) {
      return;
    }

    const currentBid = Number(newState.currentBid);
    const basePrice = Number(newState.basePrice);

    if (
      !Number.isFinite(currentBid) ||
      !Number.isFinite(basePrice) ||
      currentBid < 0 ||
      basePrice < 0
    ) {
      return;
    }

    const safeString = (value, maxLength = 500) =>
      typeof value === "string" ? value.slice(0, maxLength) : "";

    const player =
      newState.player &&
      typeof newState.player === "object" &&
      !Array.isArray(newState.player)
        ? newState.player
        : null;

    auctionState = {
      ...makeInitialAuctionState(),
      status: newState.status,
      playerId: safeString(newState.playerId, 100),
      playerName: safeString(newState.playerName || player?.name, 100),
      playerRole: safeString(
        newState.playerRole || newState.role || player?.role,
        100
      ),
      role: safeString(
        newState.role || newState.playerRole || player?.role,
        100
      ),
      playerPhoto: safeString(
        newState.playerPhoto ||
          newState.photoUrl ||
          newState.image ||
          newState.photo ||
          player?.playerPhoto ||
          player?.photoUrl ||
          player?.image ||
          player?.photo,
        1000
      ),
      photoUrl: safeString(
        newState.photoUrl ||
          newState.playerPhoto ||
          newState.image ||
          newState.photo ||
          player?.photoUrl ||
          player?.image ||
          player?.photo,
        1000
      ),
      image: safeString(
        newState.image ||
          newState.playerPhoto ||
          newState.photoUrl ||
          player?.image ||
          player?.photoUrl,
        1000
      ),
      photo: safeString(
        newState.photo ||
          newState.playerPhoto ||
          newState.photoUrl ||
          player?.photo,
        1000
      ),
      player,
      basePrice,
      currentBid,
      highestTeam: safeString(newState.highestTeam, 100),
      soldTo: safeString(newState.soldTo, 100),
      remainingPoints:
        newState.remainingPoints != null &&
        Number.isFinite(Number(newState.remainingPoints))
          ? Number(newState.remainingPoints)
          : null,
    };

    saveAuctionData();
    io.emit("auction-update", auctionState);
  });

  socket.on("auction-overview", (newOverview) => {
    if (
      !newOverview ||
      typeof newOverview !== "object" ||
      !Array.isArray(newOverview.teams) ||
      !Array.isArray(newOverview.history)
    ) {
      return;
    }

    if (newOverview.teams.length > 20 || newOverview.history.length > 1000) {
      return;
    }

    const validTeams = newOverview.teams.every(
      (team) =>
        team &&
        typeof team === "object" &&
        typeof team.id === "number" &&
        typeof team.name === "string" &&
        Number.isFinite(Number(team.initialPoints)) &&
        Number.isFinite(Number(team.remainingPoints)) &&
        Array.isArray(team.players)
    );

    if (!validTeams) return;

    auctionOverview = {
      teams: newOverview.teams,
      history: newOverview.history,
    };

    saveAuctionData();
    io.emit("auction-overview", auctionOverview);
  });

  socket.on("admin-action", (action) => {
    if (action === "undo-last-sale") {
      const result = undoLastSale();

      if (result.ok) {
        broadcastAuction();
      }

      socket.emit("admin-action-result", result);
      return;
    }

    if (action === "reset-current-player") {
      resetCurrentPlayer();
      broadcastAuction();

      socket.emit("admin-action-result", {
        ok: true,
        message: "Current player and bid have been cleared.",
      });
      return;
    }

    if (action === "reset-entire-auction") {
      auctionState = makeInitialAuctionState();
      auctionOverview = {
        teams: makeInitialTeams(),
        history: [],
      };

      broadcastAuction();

      socket.emit("admin-action-result", {
        ok: true,
        message: "Auction reset. All teams have 250 points.",
        overview: auctionOverview,
        state: auctionState,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Device disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GPL Auction server running on port ${PORT}`);
});
