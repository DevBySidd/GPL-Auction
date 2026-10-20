
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let auctionState = {
  status: "waiting",
  playerName: "",
  basePrice: 0,
  currentBid: 0,
  highestTeam: "",
  soldTo: "",
  remainingPoints: null,
};

// Team data and auction history shared with connected screens.
// Initial values are empty until the auctioneer sends the overview.
let auctionOverview = {
  teams: [],
  history: [],
};

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

  // Send the latest data to every newly connected device.
  socket.emit("auction-update", auctionState);
  socket.emit("auction-overview", auctionOverview);

  // Current player and bid updates.
  socket.on("auction-update", (newState) => {
    if (
      !newState ||
      typeof newState !== "object" ||
      Array.isArray(newState)
    ) {
      return;
    }

    const allowedStatuses = ["waiting", "bidding", "sold", "unsold"];

    if (!allowedStatuses.includes(newState.status)) return;

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

    auctionState = {
      status: newState.status,
      playerName:
        typeof newState.playerName === "string"
          ? newState.playerName.slice(0, 100)
          : "",
      basePrice,
      currentBid,
      highestTeam:
        typeof newState.highestTeam === "string"
          ? newState.highestTeam.slice(0, 100)
          : "",
      soldTo:
        typeof newState.soldTo === "string"
          ? newState.soldTo.slice(0, 100)
          : "",
      remainingPoints:
        newState.remainingPoints != null &&
        Number.isFinite(Number(newState.remainingPoints))
          ? Number(newState.remainingPoints)
          : null,
    };

    io.emit("auction-update", auctionState);
  });

  // Team points, squads, and results updates.
  socket.on("auction-overview", (newOverview) => {
    if (
      !newOverview ||
      typeof newOverview !== "object" ||
      !Array.isArray(newOverview.teams) ||
      !Array.isArray(newOverview.history)
    ) {
      return;
    }

    // Basic size limits and shape validation.
    if (
      newOverview.teams.length > 20 ||
      newOverview.history.length > 1000
    ) {
      return;
    }

    const validTeams = newOverview.teams.every((team) => {
      return (
        team &&
        typeof team === "object" &&
        typeof team.id === "number" &&
        typeof team.name === "string" &&
        Number.isFinite(Number(team.remainingPoints)) &&
        Array.isArray(team.players)
      );
    });

    if (!validTeams) return;

    auctionOverview = {
      teams: newOverview.teams,
      history: newOverview.history,
    };

    io.emit("auction-overview", auctionOverview);
  });

  socket.on("disconnect", () => {
    console.log("Device disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`GPL Auction server running on port ${PORT}`);
});
