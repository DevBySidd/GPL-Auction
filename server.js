
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
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "auction-data.json");

const INITIAL_POINTS = 250;
const MAX_PLAYER_BID = 50;

const AUCTIONEER = {
  username: "Gpl",
  password: "Gpl12",
};

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

function makeInitialTeams() {
  return TEAM_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    initialPoints: INITIAL_POINTS,
    remainingPoints: INITIAL_POINTS,
    players: [],
  }));
}

function makeInitialAuctionState() {
  return {
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
  };
}

let auctionState = makeInitialAuctionState();

let auctionOverview = {
  teams: makeInitialTeams(),
  history: [],
};

function saveAuctionData() {
  try {
    const temporaryFile = DATA_FILE + ".tmp";

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
    const saved = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (
      saved.auctionState &&
      typeof saved.auctionState === "object"
    ) {
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
    console.error(
      "Could not read auction data:",
      error.message
    );
  }
}

function sendAuctionData(socket) {
  socket.emit("auction-update", auctionState);
  socket.emit("auction-overview", auctionOverview);
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
      message: "Winning team was not found.",
    };
  }

  const amount = Number(sale.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false,
      message: "Invalid sale amount.",
    };
  }

  const playerIndex = team.players.findIndex(
    (player) =>
      sale.playerId
        ? String(player.id) === String(sale.playerId)
        : player.name === sale.player
  );

  if (playerIndex === -1) {
    return {
      ok: false,
      message: "Sold player was not found in the team.",
    };
  }

  team.remainingPoints = Math.min(
    Number(team.initialPoints),
    Number(team.remainingPoints) + amount
  );

  team.players.splice(playerIndex, 1);
  auctionOverview.history.splice(saleIndex, 1);

  if (
    String(auctionState.playerId) ===
      String(sale.playerId) ||
    auctionState.playerName === sale.player
  ) {
    resetCurrentPlayer();
  }

  return {
    ok: true,
    message:
      `Sale of ${sale.player} undone. ` +
      `${team.name} received ${amount} points back.`,
  };
}

function validAuctionState(state) {
  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state)
  ) {
    return false;
  }

  if (
    !["waiting", "bidding", "sold", "unsold"].includes(
      state.status
    )
  ) {
    return false;
  }

  const bid = Number(state.currentBid);
  const base = Number(state.basePrice);

  return (
    Number.isFinite(bid) &&
    Number.isFinite(base) &&
    bid >= 0 &&
    bid <= MAX_PLAYER_BID &&
    base >= 0 &&
    base <= MAX_PLAYER_BID
  );
}

function validAuctionOverview(overview) {
  if (
    !overview ||
    !Array.isArray(overview.teams) ||
    !Array.isArray(overview.history)
  ) {
    return false;
  }

  if (
    overview.teams.length !== TEAM_NAMES.length ||
    overview.history.length > 1000
  ) {
    return false;
  }

  return overview.teams.every((team) => {
    if (
      !team ||
      !Number.isInteger(team.id) ||
      !Array.isArray(team.players)
    ) {
      return false;
    }

    const initial = Number(team.initialPoints);
    const remaining = Number(team.remainingPoints);

    return (
      team.id >= 1 &&
      team.id <= TEAM_NAMES.length &&
      team.name === TEAM_NAMES[team.id - 1] &&
      initial === INITIAL_POINTS &&
      Number.isFinite(remaining) &&
      remaining >= 0 &&
      remaining <= initial
    );
  });
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

  socket.data.isAdmin = false;

  // Send saved auction data to every new device.
  sendAuctionData(socket);

  // Authenticate the auctioneer.
  socket.on("admin-auth", (credentials) => {
    const valid =
      credentials?.username === AUCTIONEER.username &&
      credentials?.password === AUCTIONEER.password;

    socket.data.isAdmin = valid;

    socket.emit("admin-auth-result", {
      ok: valid,
      message: valid
        ? "Auctioneer authenticated."
        : "Invalid auctioneer credentials.",
    });
  });

  socket.on("admin-logout", () => {
    socket.data.isAdmin = false;
  });

  // Update live player and bid.
  socket.on("auction-update", (newState) => {
    if (!socket.data.isAdmin) {
      return;
    }

    if (!validAuctionState(newState)) {
      return;
    }

    const safeString = (value, max = 1000) =>
      typeof value === "string"
        ? value.slice(0, max)
        : "";

    const player =
      newState.player &&
      typeof newState.player === "object" &&
      !Array.isArray(newState.player)
        ? newState.player
        : null;

    const photo =
      newState.playerPhoto ||
      newState.photoUrl ||
      newState.image ||
      newState.photo ||
      player?.photoUrl ||
      player?.image ||
      "";

    const nextState = {
      ...makeInitialAuctionState(),
      status: newState.status,
      playerId: safeString(newState.playerId, 100),
      playerName: safeString(
        newState.playerName || player?.name,
        100
      ),
      playerRole: safeString(
        newState.playerRole || newState.role || player?.role,
        100
      ),
      role: safeString(
        newState.role || newState.playerRole || player?.role,
        100
      ),
      playerPhoto: safeString(photo),
      photoUrl: safeString(photo),
      image: safeString(photo),
      photo: safeString(photo),
      player,
      basePrice: Number(newState.basePrice),
      currentBid: Number(newState.currentBid),
      highestTeam: safeString(newState.highestTeam, 100),
      soldTo: safeString(newState.soldTo, 100),
      remainingPoints:
        newState.remainingPoints == null
          ? null
          : Number(newState.remainingPoints),
    };

    if (
      JSON.stringify(nextState) ===
      JSON.stringify(auctionState)
    ) {
      return;
    }

    auctionState = nextState;

    saveAuctionData();

    // Send updates to other devices.
    // Avoid echoing the same update to the sender.
    socket.broadcast.emit("auction-update", auctionState);
  });

  // Update teams, points, and history.
  socket.on("auction-overview", (newOverview) => {
    if (!socket.data.isAdmin) {
      return;
    }

    if (!validAuctionOverview(newOverview)) {
      return;
    }

    if (
      JSON.stringify(newOverview) ===
      JSON.stringify(auctionOverview)
    ) {
      return;
    }

    auctionOverview = {
      teams: newOverview.teams,
      history: newOverview.history,
    };

    saveAuctionData();

    socket.broadcast.emit(
      "auction-overview",
      auctionOverview
    );
  });

  // Admin recovery controls.
  socket.on("admin-action", (action) => {
    if (!socket.data.isAdmin) {
      socket.emit("admin-action-result", {
        ok: false,
        message:
          "Unauthorized. Please log in as auctioneer.",
      });
      return;
    }

    if (action === "undo-last-sale") {
      const result = undoLastSale();

      if (result.ok) {
        broadcastAuction();
      }

      socket.emit("admin-action-result", {
        ...result,
        state: auctionState,
        overview: auctionOverview,
      });

      return;
    }

    if (action === "reset-current-player") {
      resetCurrentPlayer();

      broadcastAuction();

      socket.emit("admin-action-result", {
        ok: true,
        message:
          "Current player and bid have been cleared.",
        state: auctionState,
        overview: auctionOverview,
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
        message:
          "Entire auction reset. All teams have 250 points.",
        state: auctionState,
        overview: auctionOverview,
      });

      return;
    }

    socket.emit("admin-action-result", {
      ok: false,
      message: "Unknown admin action.",
    });
  });

  socket.on("disconnect", () => {
    console.log("Device disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `GPL Auction server running on port ${PORT}`
  );
});
