
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  LockKeyhole,
  UserRound,
  LogIn,
  Users,
  Coins,
  Gavel,
  LogOut,
  UserPlus,
  CheckCircle,
  XCircle,
  Radio,
} from "lucide-react";

import {
  AUCTIONEER,
  INITIAL_TABLES,
  INITIAL_POINTS,
  MAX_PLAYER_BID,
} from "./data/auctionData";

import { players as playerDatabase } from "./data/players";
import Intro from "./Intro.jsx";
import "./App.css";

const SERVER_URL = "http://localhost:4000";

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "7px",
  borderRadius: "8px",
  border: "1px solid #343640",
  background: "#11131a",
  color: "#ffffff",
  fontSize: "14px",
  boxSizing: "border-box",
};

const panelStyle = {
  background: "#14151c",
  border: "1px solid #292b35",
  borderRadius: "14px",
  padding: "20px",
};

const actionButtonStyle = {
  padding: "12px 16px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontWeight: "700",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

function App() {
  const [introFinished, setIntroFinished] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");

  const [teams, setTeams] = useState(() =>
    INITIAL_TABLES.map((team) => ({
      ...team,
      players: [...team.players],
    }))
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("1");
  const [currentBid, setCurrentBid] = useState(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);

  const [startingBid, setStartingBid] = useState(5);
  const [bidIncrement, setBidIncrement] = useState(5);

  const [auctionDisplay, setAuctionDisplay] = useState({
    status: "waiting",
    playerId: "",
    playerName: "",
    playerRole: "",
    playerPhoto: "",
    photoUrl: "",
    basePrice: 5,
    currentBid: 0,
    highestTeam: "",
    soldTo: "",
    remainingPoints: null,
  });

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [adminActionBusy, setAdminActionBusy] = useState(false);
  const hydratedRef = useRef(false);
  const receivedStateRef = useRef(false);
  const receivedOverviewRef = useRef(false);
  const adminResultHandlerRef = useRef(null);

  // Keep the selected player's full database record.
  const selectedPlayer = playerDatabase.find(
    (player) => player.id === selectedPlayerId
  );

  // Once a player has an auction result, remove them from the available list.
  const completedPlayerIds = new Set(
    history.map((item) => item.playerId).filter(Boolean)
  );

  const availablePlayers = playerDatabase.filter(
    (player) => !completedPlayerIds.has(player.id)
  );

  useEffect(() => {
    const connection = io(SERVER_URL);
    setSocket(connection);

    connection.on("connect", () => setConnected(true));
    connection.on("disconnect", () => setConnected(false));
    connection.on("connect_error", () => setConnected(false));

    connection.on("auction-update", (savedState) => {
      if (!savedState || typeof savedState !== "object") return;
      setAuctionDisplay((previous) => ({ ...previous, ...savedState }));
      receivedStateRef.current = true;
      if (receivedStateRef.current && receivedOverviewRef.current) {
        hydratedRef.current = true;
      }
    });

    connection.on("auction-overview", (savedOverview) => {
      if (!savedOverview || !Array.isArray(savedOverview.teams) || !Array.isArray(savedOverview.history)) return;
      setTeams(savedOverview.teams);
      setHistory(savedOverview.history);
      receivedOverviewRef.current = true;
      if (receivedStateRef.current && receivedOverviewRef.current) {
        hydratedRef.current = true;
      }
    });

    connection.on("admin-action-result", (result) => {
      setAdminActionBusy(false);
      setMessage(result?.message || (result?.ok ? "Admin action completed." : "Admin action failed."));
      if (result?.ok && result.state) setAuctionDisplay(result.state);
      if (result?.ok && result.overview) {
        setTeams(result.overview.teams || []);
        setHistory(result.overview.history || []);
      }
    });

    return () => connection.disconnect();
  }, []);

  // Do not send local defaults until the server's saved state has arrived.
  useEffect(() => {
    if (socket?.connected && loggedIn && hydratedRef.current) {
      socket.emit("auction-update", auctionDisplay);
    }
  }, [socket, auctionDisplay, connected, loggedIn]);

  useEffect(() => {
    if (socket?.connected && loggedIn && hydratedRef.current) {
      socket.emit("auction-overview", { teams, history });
    }
  }, [socket, teams, history, connected, loggedIn]);

  // Rebuild the current bid after a refresh if the saved auction was in progress.
  useEffect(() => {
    if (!hydratedRef.current || auctionDisplay.status !== "bidding" || !auctionDisplay.currentBid || !auctionDisplay.highestTeam) return;
    const winningTeam = teams.find((team) => team.name === auctionDisplay.highestTeam);
    if (!winningTeam) return;
    setCurrentBid((previous) => {
      if (previous?.teamId === winningTeam.id && previous?.amount === Number(auctionDisplay.currentBid)) return previous;
      return { teamId: winningTeam.id, teamName: winningTeam.name, amount: Number(auctionDisplay.currentBid) };
    });
    setPlayerName(auctionDisplay.playerName || "");
    setSelectedPlayerId(auctionDisplay.playerId || "");
  }, [teams, auctionDisplay, connected]);

  const selectedTeam = teams.find(
    (team) => team.id === Number(selectedTeamId)
  );

  const totalSpent = teams.reduce(
    (total, team) => total + team.initialPoints - team.remainingPoints,
    0
  );

  const totalPlayersSold = teams.reduce(
    (total, team) => total + team.players.length,
    0
  );

  const biddingActive = auctionDisplay.status === "bidding";

  const nextBidAmount =
    currentBid === null
      ? startingBid
      : currentBid.amount + bidIncrement;

  const maximumBidReached =
    currentBid !== null && currentBid.amount >= MAX_PLAYER_BID;

  const bidSettingsValid =
    Number.isFinite(startingBid) &&
    Number.isFinite(bidIncrement) &&
    startingBid > 0 &&
    bidIncrement > 0 &&
    startingBid <= MAX_PLAYER_BID &&
    Number.isInteger(startingBid) &&
    Number.isInteger(bidIncrement);

  const handleLogin = (event) => {
    event.preventDefault();

    if (
      username.trim() === AUCTIONEER.username &&
      password === AUCTIONEER.password
    ) {
      setLoggedIn(true);
      setError("");
      if (socket?.connected) {
        socket.emit("admin-auth", { username: AUCTIONEER.username, password: AUCTIONEER.password });
      }
    } else {
      setError("Invalid username or password.");
    }
  };


  useEffect(() => {
    if (loggedIn && socket?.connected) {
      socket.emit("admin-auth", { username: AUCTIONEER.username, password: AUCTIONEER.password });
    }
  }, [loggedIn, socket, connected]);

  const runAdminAction = (action) => {
    if (!loggedIn || !socket?.connected) {
      setMessage("Connect to the auction server and sign in first.");
      return;
    }
    const prompts = {
      "undo-last-sale": "Undo the most recent sale? The team will receive the points back.",
      "reset-current-player": "Clear the current player and current bid?",
      "reset-entire-auction": "Reset the ENTIRE auction? This clears all squads, points spent, and auction history.",
    };
    if (!window.confirm(prompts[action])) return;
    setAdminActionBusy(true);
    socket.emit("admin-action", action);
  };

  const handleLogout = () => {
    socket?.emit("admin-logout");
    setLoggedIn(false);
    setUsername("");
    setPassword("");
  };

  const handlePlayerSelection = (event) => {
    const id = event.target.value;
    setSelectedPlayerId(id);

    const player = playerDatabase.find((item) => item.id === id);
    setPlayerName(player?.name || "");
    setMessage("");
  };

  const handleStartPlayer = (event) => {
    event.preventDefault();

    if (!selectedPlayer) {
      setMessage("Please select a player from the player list.");
      return;
    }

    if (completedPlayerIds.has(selectedPlayer.id)) {
      setMessage("This player already has an auction result.");
      return;
    }

    if (biddingActive) {
      setMessage("Finish the current player's auction first.");
      return;
    }

    if (!bidSettingsValid) {
      setMessage(
        `Enter a valid starting bid and increment. The starting bid must be between 1 and ${MAX_PLAYER_BID} points.`
      );
      return;
    }

    setCurrentBid(null);

    setAuctionDisplay({
      status: "bidding",
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      playerRole: selectedPlayer.role || "Player",
      playerPhoto: selectedPlayer.photoUrl || "",
      photoUrl: selectedPlayer.photoUrl || "",
      basePrice: startingBid,
      currentBid: 0,
      highestTeam: "",
      soldTo: "",
      remainingPoints: null,
    });

    setPlayerName(selectedPlayer.name);

    setMessage(
      `Bidding started for ${selectedPlayer.name}. First bid: ${startingBid} points. Increment: ${bidIncrement} points.`
    );
  };

  const handlePlaceBid = () => {
    if (!playerName.trim()) {
      setMessage("Select a player first.");
      return;
    }

    if (!biddingActive) {
      setMessage("Click Prepare Player before placing a bid.");
      return;
    }

    if (!selectedTeam) {
      setMessage("Please select a team.");
      return;
    }

    if (!bidSettingsValid) {
      setMessage("Please check the starting bid and increment.");
      return;
    }

    if (nextBidAmount > MAX_PLAYER_BID) {
      setMessage(
        `The next bid would exceed the maximum of ${MAX_PLAYER_BID} points.`
      );
      return;
    }

    if (currentBid && currentBid.teamId === selectedTeam.id) {
      setMessage("Select a different team to raise the bid.");
      return;
    }

    if (nextBidAmount > selectedTeam.remainingPoints) {
      setMessage(
        `${selectedTeam.name} does not have enough points for a ${nextBidAmount}-point bid.`
      );
      return;
    }

    const newBid = {
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      amount: nextBidAmount,
    };

    setCurrentBid(newBid);

    setAuctionDisplay((previous) => ({
      ...previous,
      status: "bidding",
      currentBid: newBid.amount,
      highestTeam: newBid.teamName,
      soldTo: "",
      remainingPoints: selectedTeam.remainingPoints,
    }));

    setMessage(
      `${newBid.teamName} is leading at ${newBid.amount} points.`
    );
  };

  const handleSold = () => {
    if (!biddingActive || !currentBid || !auctionDisplay.playerName) {
      setMessage("Start bidding and receive a bid before marking SOLD.");
      return;
    }

    const winningTeam = teams.find(
      (team) => team.id === currentBid.teamId
    );

    if (!winningTeam || currentBid.amount > winningTeam.remainingPoints) {
      setMessage("The winning team does not have enough points.");
      return;
    }

    const soldPlayer = {
      id: auctionDisplay.playerId,
      name: auctionDisplay.playerName,
      role: auctionDisplay.playerRole,
      photoUrl: auctionDisplay.playerPhoto || "",
      price: currentBid.amount,
    };

    setTeams((previousTeams) =>
      previousTeams.map((team) =>
        team.id === currentBid.teamId
          ? {
              ...team,
              remainingPoints: team.remainingPoints - currentBid.amount,
              players: [...team.players, soldPlayer],
            }
          : team
      )
    );

    setHistory((previousHistory) => [
      {
        playerId: soldPlayer.id,
        player: soldPlayer.name,
        team: currentBid.teamName,
        amount: currentBid.amount,
        status: "SOLD",
      },
      ...previousHistory,
    ]);

    setAuctionDisplay((previous) => ({
      ...previous,
      status: "sold",
      playerName: soldPlayer.name,
      playerRole: soldPlayer.role,
      playerPhoto: soldPlayer.photoUrl,
      photoUrl: soldPlayer.photoUrl,
      currentBid: currentBid.amount,
      highestTeam: currentBid.teamName,
      soldTo: currentBid.teamName,
      remainingPoints: winningTeam.remainingPoints - currentBid.amount,
    }));

    setMessage(
      `SOLD! ${soldPlayer.name} to ${currentBid.teamName} for ${currentBid.amount} points.`
    );

    setSelectedPlayerId("");
    setPlayerName("");
    setCurrentBid(null);
  };

  const handleUnsold = () => {
    if (!biddingActive || !auctionDisplay.playerName) {
      setMessage("Prepare a player before marking UNSOLD.");
      return;
    }

    const unsoldPlayer = {
      id: auctionDisplay.playerId,
      name: auctionDisplay.playerName,
    };

    setHistory((previousHistory) => [
      {
        playerId: unsoldPlayer.id,
        player: unsoldPlayer.name,
        team: currentBid?.teamName || "No team",
        amount: currentBid?.amount ?? 0,
        status: "UNSOLD",
      },
      ...previousHistory,
    ]);

    setAuctionDisplay((previous) => ({
      ...previous,
      status: "unsold",
      currentBid: currentBid?.amount ?? 0,
      highestTeam: currentBid?.teamName ?? "",
      soldTo: "",
      remainingPoints: null,
    }));

    setMessage(`${unsoldPlayer.name} marked UNSOLD.`);

    setSelectedPlayerId("");
    setPlayerName("");
    setCurrentBid(null);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!introFinished && (
          <Intro onFinish={() => setIntroFinished(true)} />
        )}
      </AnimatePresence>

      {!loggedIn ? (
        <main className="login-page">
          <motion.div
            className="login-layout"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <section className="welcome-panel">
              <div className="brand-mark">
                <Trophy size={30} />
              </div>

              <p className="eyebrow">GARLGUNJI PREMIER LEAGUE</p>

              <h1>
                THE GAME.
                <br />
                THE GLORY.
                <br />
                <span>THE AUCTION.</span>
              </h1>

              <p className="welcome-description">
                Every player has a price. Every bid changes the game.
                Welcome to the GPL player auction.
              </p>

              <div className="points-card">
                <div>
                  <span>PARTICIPATING TEAMS</span>
                  <strong>{INITIAL_TABLES.length}</strong>
                </div>
                <div>
                  <span>POINTS PER TEAM</span>
                  <strong>{INITIAL_POINTS}</strong>
                </div>
                <div>
                  <span>MAXIMUM BID</span>
                  <strong>{MAX_PLAYER_BID}</strong>
                </div>
              </div>
            </section>

            <section className="login-card">
              <div className="login-heading">
                <span className="login-icon">
                  <LockKeyhole size={23} />
                </span>
                <p className="eyebrow">RESTRICTED ACCESS</p>
                <h2>Auctioneer Login</h2>
                <p>Sign in to manage the GPL player auction.</p>
              </div>

              <form onSubmit={handleLogin}>
                <label htmlFor="username">Username</label>
                <div className="input-wrap">
                  <UserRound size={18} />
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && <p className="login-error">{error}</p>}

                <button className="login-button" type="submit">
                  Enter Auction Control <LogIn size={18} />
                </button>
              </form>

              <p className="login-footer">
                <LockKeyhole size={14} /> Auctioneer access only
              </p>
            </section>
          </motion.div>
        </main>
      ) : (
        <main className="dashboard-page">
          <header className="dashboard-header">
            <div className="dashboard-brand">
              <span className="brand-mark small">
                <Trophy size={22} />
              </span>
              <div>
                <h1>
                  GPL <span>AUCTION</span>
                </h1>
                <p>GARLGUNJI PREMIER LEAGUE</p>
              </div>
            </div>

            <div className="header-actions">
              <span className="live-indicator">
                <span />
                {connected ? "SERVER CONNECTED" : "SERVER OFFLINE"}
              </span>
              <button className="logout-button" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          </header>

          <section className="dashboard-content">
            <div className="dashboard-title">
              <div>
                <p className="eyebrow">AUCTION MANAGEMENT</p>
                <h2>Welcome, Auctioneer.</h2>
                <p>Manage teams, points, and player bidding from one place.</p>
              </div>
              <div className="auction-status">
                <span className="status-dot" /> SYSTEM READY
              </div>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <Users size={21} />
                <span>Participating Teams</span>
                <strong>{teams.length}</strong>
              </article>
              <article className="stat-card">
                <Coins size={21} />
                <span>Points Spent</span>
                <strong>{totalSpent}</strong>
              </article>
              <article className="stat-card">
                <Trophy size={21} />
                <span>Players Sold</span>
                <strong>{totalPlayersSold}</strong>
              </article>
            </div>

            <section
              style={{
                ...panelStyle,
                marginTop: "24px",
                marginBottom: "24px",
              }}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">LIVE AUCTION</p>
                  <h3>Player Bidding Control</h3>
                </div>
                <span className="team-count">
                  <Radio size={14} /> AUCTIONEER
                </span>
              </div>

              <form
                onSubmit={handleStartPlayer}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginTop: "20px",
                }}
              >
                <label>
                  Select player ({availablePlayers.length} available)
                  <select
                    style={inputStyle}
                    value={selectedPlayerId}
                    onChange={handlePlayerSelection}
                    disabled={biddingActive}
                    required
                  >
                    <option value="">Choose a player...</option>
                    {availablePlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} — {player.role || "Role not set"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Starting bid (points)
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    max={MAX_PLAYER_BID}
                    step="1"
                    value={startingBid}
                    onChange={(event) =>
                      setStartingBid(Number(event.target.value))
                    }
                    disabled={biddingActive}
                    required
                  />
                </label>

                <label>
                  Bid increment (points)
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    step="1"
                    value={bidIncrement}
                    onChange={(event) =>
                      setBidIncrement(Number(event.target.value))
                    }
                    disabled={biddingActive}
                    required
                  />
                </label>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    type="submit"
                    style={{
                      ...actionButtonStyle,
                      background: "#292b35",
                      width: "100%",
                    }}
                    disabled={biddingActive || !selectedPlayer}
                  >
                    <UserPlus size={17} /> Prepare Player
                  </button>
                </div>
              </form>

              {selectedPlayer && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    marginTop: "16px",
                    padding: "14px",
                    background: "#0d0e13",
                    borderRadius: "10px",
                  }}
                >
                  {selectedPlayer.photoUrl ? (
                    <img
                      src={selectedPlayer.photoUrl}
                      alt={selectedPlayer.name}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      style={{
                        width: "76px",
                        height: "76px",
                        objectFit: "cover",
                        borderRadius: "10px",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "76px",
                        height: "76px",
                        borderRadius: "10px",
                        background: "#22242d",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <UserRound size={30} color="#a7a8b3" />
                    </div>
                  )}
                  <div>
                    <strong>{selectedPlayer.name}</strong>
                    <p style={{ color: "#a7a8b3", marginTop: "6px" }}>
                      {selectedPlayer.role || "Role not set"}
                    </p>
                    <p style={{ color: "#a7a8b3", fontSize: "12px" }}>
                      Slot {selectedPlayer.slot ?? "—"} ·{" "}
                      {selectedPlayer.matchStatus || "Status not set"}
                    </p>
                  </div>
                </div>
              )}

              <p style={{ color: "#a7a8b3", fontSize: "13px", marginTop: "12px" }}>
                Maximum bid: {MAX_PLAYER_BID} points. Completed players will
                be removed from the available list.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginTop: "18px",
                }}
              >
                <label>
                  Bidding team
                  <select
                    style={inputStyle}
                    value={selectedTeamId}
                    onChange={(event) => setSelectedTeamId(event.target.value)}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} — {team.remainingPoints} pts left
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Next bid (points)
                  <input
                    style={inputStyle}
                    type="number"
                    value={
                      nextBidAmount <= MAX_PLAYER_BID
                        ? nextBidAmount
                        : MAX_PLAYER_BID
                    }
                    readOnly
                  />
                </label>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    type="button"
                    onClick={handlePlaceBid}
                    disabled={
                      !biddingActive ||
                      !bidSettingsValid ||
                      maximumBidReached ||
                      nextBidAmount > MAX_PLAYER_BID ||
                      !selectedTeam ||
                      nextBidAmount > selectedTeam.remainingPoints ||
                      (currentBid && currentBid.teamId === selectedTeam?.id)
                    }
                    style={{
                      ...actionButtonStyle,
                      background: "#f47b20",
                      color: "#111",
                      width: "100%",
                      opacity:
                        !biddingActive ||
                        !bidSettingsValid ||
                        maximumBidReached ||
                        nextBidAmount > MAX_PLAYER_BID ||
                        !selectedTeam ||
                        nextBidAmount > selectedTeam.remainingPoints ||
                        (currentBid && currentBid.teamId === selectedTeam?.id)
                          ? 0.5
                          : 1,
                    }}
                  >
                    <Gavel size={17} />
                    {maximumBidReached
                      ? "Maximum Bid Reached"
                      : "Place / Raise Bid"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  padding: "22px",
                  borderRadius: "12px",
                  background: "#0d0e13",
                  border: "1px solid #30313a",
                  textAlign: "center",
                }}
              >
                <p className="eyebrow">CURRENT PLAYER</p>

                {auctionDisplay.playerPhoto && (
                  <img
                    src={auctionDisplay.playerPhoto}
                    alt={auctionDisplay.playerName}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    style={{
                      width: "110px",
                      height: "110px",
                      objectFit: "cover",
                      borderRadius: "12px",
                      marginTop: "12px",
                    }}
                  />
                )}

                <h2
                  style={{
                    margin: "10px 0",
                    fontSize: "clamp(24px, 4vw, 38px)",
                  }}
                >
                  {auctionDisplay.playerName || "Waiting for player"}
                </h2>

                {auctionDisplay.playerRole && (
                  <p style={{ color: "#a7a8b3" }}>
                    {auctionDisplay.playerRole}
                  </p>
                )}

                <p style={{ color: "#a7a8b3", marginTop: "14px" }}>
                  Starting bid: {auctionDisplay.basePrice} points
                </p>

                <p style={{ color: "#a7a8b3", marginTop: "14px" }}>
                  {currentBid ? "HIGHEST BID" : "NO BIDS YET"}
                </p>

                <h2
                  style={{
                    color: "#f47b20",
                    fontSize: "clamp(32px, 5vw, 48px)",
                    margin: "5px 0",
                  }}
                >
                  {currentBid ? `${currentBid.amount} PTS` : "—"}
                </h2>

                <p style={{ fontSize: "18px", fontWeight: "700" }}>
                  {currentBid?.teamName || "Waiting for the first bid"}
                </p>

                {maximumBidReached && (
                  <p style={{ color: "#fbbf24", fontWeight: "700" }}>
                    Maximum bid reached: {MAX_PLAYER_BID} points.
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    justifyContent: "center",
                    marginTop: "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleSold}
                    disabled={!currentBid || !biddingActive}
                    style={{
                      ...actionButtonStyle,
                      background: "#218c55",
                      opacity: currentBid && biddingActive ? 1 : 0.45,
                    }}
                  >
                    <CheckCircle size={18} /> SOLD
                  </button>

                  <button
                    type="button"
                    onClick={handleUnsold}
                    disabled={!auctionDisplay.playerName || !biddingActive}
                    style={{
                      ...actionButtonStyle,
                      background: "#bd3843",
                      opacity:
                        auctionDisplay.playerName && biddingActive ? 1 : 0.45,
                    }}
                  >
                    <XCircle size={18} /> UNSOLD
                  </button>
                </div>
              </div>

              {message && (
                <p
                  role="status"
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#20212a",
                    color: "#f7f7fa",
                  }}
                >
                  {message}
                </p>
              )}
            </section>

            <section style={{ ...panelStyle, marginTop: "24px" }}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">ADMIN TOOLS</p>
                  <h3>Auction Recovery & Reset</h3>
                </div>
              </div>
              <p style={{ color: "#a7a8b3", fontSize: "13px", margin: "10px 0 16px" }}>
                Use these controls carefully. Reset Entire Auction removes all recorded sales and restores every team to {INITIAL_POINTS} points.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <button type="button" onClick={() => runAdminAction("undo-last-sale")} disabled={adminActionBusy || !connected} style={{ ...actionButtonStyle, background: "#a66a12", opacity: adminActionBusy || !connected ? 0.55 : 1 }}>
                  Undo Last Sale
                </button>
                <button type="button" onClick={() => runAdminAction("reset-current-player")} disabled={adminActionBusy || !connected} style={{ ...actionButtonStyle, background: "#454858", opacity: adminActionBusy || !connected ? 0.55 : 1 }}>
                  Reset Current Player
                </button>
                <button type="button" onClick={() => runAdminAction("reset-entire-auction")} disabled={adminActionBusy || !connected} style={{ ...actionButtonStyle, background: "#bd3843", opacity: adminActionBusy || !connected ? 0.55 : 1 }}>
                  Reset Entire Auction
                </button>
              </div>
            </section>

            <section className="teams-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TEAM OVERVIEW</p>
                  <h3>Registered Auction Teams</h3>
                </div>
                <span className="team-count">{teams.length} TEAMS</span>
              </div>

              <div className="teams-grid">
                {teams.map((team) => (
                  <motion.article
                    className="team-card"
                    key={team.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="team-card-top">
                      <span className="team-number">
                        {String(team.id).padStart(2, "0")}
                      </span>
                      <span className="team-status">REGISTERED</span>
                    </div>

                    <h4>{team.name}</h4>

                    <div className="team-points">
                      <div>
                        <span>AVAILABLE POINTS</span>
                        <strong>{team.remainingPoints}</strong>
                      </div>
                      <Coins size={20} />
                    </div>

                    <div className="points-track">
                      <span
                        style={{
                          width: `${
                            team.initialPoints > 0
                              ? Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (team.remainingPoints /
                                      team.initialPoints) *
                                      100
                                  )
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div style={{ marginTop: "16px" }}>
                      <strong style={{ fontSize: "13px" }}>
                        Squad: {team.players.length} player(s)
                      </strong>

                      {team.players.length > 0 && (
                        <ul style={{ paddingLeft: "18px", color: "#c6c7cf" }}>
                          {team.players.map((player, index) => (
                            <li key={`${player.id || player.name}-${index}`}>
                              {player.name} — {player.price} pts
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.article>
                ))}
              </div>
            </section>

            <section style={{ ...panelStyle, marginTop: "24px" }}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">AUCTION RECORD</p>
                  <h3>Recent Results</h3>
                </div>
              </div>

              {history.length === 0 ? (
                <p style={{ color: "#a7a8b3", marginTop: "16px" }}>
                  No players have been sold or marked unsold yet.
                </p>
              ) : (
                <div style={{ overflowX: "auto", marginTop: "16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#a7a8b3" }}>
                        <th style={{ padding: "12px" }}>Player</th>
                        <th style={{ padding: "12px" }}>Team</th>
                        <th style={{ padding: "12px" }}>Bid</th>
                        <th style={{ padding: "12px" }}>Result</th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((item, index) => (
                        <tr key={`${item.playerId || item.player}-${index}`}>
                          <td style={{ padding: "12px", borderTop: "1px solid #292b35" }}>
                            {item.player}
                          </td>
                          <td style={{ padding: "12px", borderTop: "1px solid #292b35" }}>
                            {item.team}
                          </td>
                          <td style={{ padding: "12px", borderTop: "1px solid #292b35" }}>
                            {item.amount} pts
                          </td>
                          <td style={{ padding: "12px", borderTop: "1px solid #292b35" }}>
                            <strong
                              style={{
                                color:
                                  item.status === "SOLD"
                                    ? "#55d995"
                                    : "#ff747d",
                              }}
                            >
                              {item.status}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        </main>
      )}
    </>
  );
}

export default App;
