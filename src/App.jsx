
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { motion } from "framer-motion";
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

  const [playerName, setPlayerName] = useState("");
  const [basePrice, setBasePrice] = useState("1");
  const [bidAmount, setBidAmount] = useState("1");
  const [selectedTeamId, setSelectedTeamId] = useState("1");
  const [currentBid, setCurrentBid] = useState(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);

  const [auctionDisplay, setAuctionDisplay] = useState({
    status: "waiting",
    playerName: "",
    basePrice: 0,
    currentBid: 0,
    highestTeam: "",
    soldTo: "",
    remainingPoints: null,
  });

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // Connect to the auction server.
  useEffect(() => {
    const connection = io(SERVER_URL);

    setSocket(connection);

    connection.on("connect", () => {
      setConnected(true);
      console.log("Connected to GPL auction server");
    });

    connection.on("disconnect", () => {
      setConnected(false);
      console.warn("Disconnected from GPL auction server");
    });

    connection.on("connect_error", (err) => {
      setConnected(false);
      console.error("GPL auction server connection failed:", err.message);
    });

    return () => {
      connection.disconnect();
    };
  }, []);

  // Broadcast current player and bid information.
  useEffect(() => {
    if (socket?.connected) {
      socket.emit("auction-update", auctionDisplay);
    }
  }, [socket, auctionDisplay, connected]);

  // Broadcast team points, purchased players, and auction results.
  useEffect(() => {
    if (socket?.connected) {
      socket.emit("auction-overview", {
        teams,
        history,
      });
    }
  }, [socket, teams, history, connected]);

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

  const handleLogin = (event) => {
    event.preventDefault();

    if (
      username.trim() === AUCTIONEER.username &&
      password === AUCTIONEER.password
    ) {
      setLoggedIn(true);
      setError("");
    } else {
      setError("Invalid username or password.");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUsername("");
    setPassword("");
  };

  const handleStartPlayer = (event) => {
    event.preventDefault();

    if (!playerName.trim()) {
      setMessage("Please enter the player's name.");
      return;
    }

    if (currentBid) {
      setMessage("Finish the current player's auction first.");
      return;
    }

    const base = Number(basePrice);

    if (!Number.isFinite(base) || base < 1 || base > MAX_PLAYER_BID) {
      setMessage(`Base price must be between 1 and ${MAX_PLAYER_BID}.`);
      return;
    }

    setCurrentBid(null);
    setBidAmount(String(base));

    setAuctionDisplay({
      status: "bidding",
      playerName: playerName.trim(),
      basePrice: base,
      currentBid: 0,
      highestTeam: "",
      soldTo: "",
      remainingPoints: null,
    });

    setMessage(`Bidding opened for ${playerName.trim()}.`);
  };

  const handlePlaceBid = () => {
    const amount = Number(bidAmount);
    const base = Number(basePrice);

    if (!playerName.trim()) {
      setMessage("Enter a player name first.");
      return;
    }

    if (!selectedTeam) {
      setMessage("Please select a team.");
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount < base ||
      amount > MAX_PLAYER_BID
    ) {
      setMessage(
        `Bid must be at least ${base} and cannot exceed ${MAX_PLAYER_BID} points.`
      );
      return;
    }

    if (currentBid && amount <= currentBid.amount) {
      setMessage(
        `The next bid must be higher than ${currentBid.amount} points.`
      );
      return;
    }

    if (amount > selectedTeam.remainingPoints) {
      setMessage(`${selectedTeam.name} does not have enough points.`);
      return;
    }

    setCurrentBid({
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      amount,
    });

    setAuctionDisplay({
      status: "bidding",
      playerName: playerName.trim(),
      basePrice: base,
      currentBid: amount,
      highestTeam: selectedTeam.name,
      soldTo: "",
      remainingPoints: selectedTeam.remainingPoints,
    });

    setMessage(`${selectedTeam.name} is leading at ${amount} points.`);
  };

  const handleSold = () => {
    if (!playerName.trim() || !currentBid) {
      setMessage("A player and a valid leading bid are required.");
      return;
    }

    const winningTeam = teams.find(
      (team) => team.id === currentBid.teamId
    );

    if (!winningTeam || currentBid.amount > winningTeam.remainingPoints) {
      setMessage("This team no longer has enough points for the bid.");
      return;
    }

    const soldPlayer = {
      name: playerName.trim(),
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
        player: soldPlayer.name,
        team: currentBid.teamName,
        amount: currentBid.amount,
        status: "SOLD",
      },
      ...previousHistory,
    ]);

    setAuctionDisplay({
      status: "sold",
      playerName: soldPlayer.name,
      basePrice: Number(basePrice),
      currentBid: currentBid.amount,
      highestTeam: currentBid.teamName,
      soldTo: currentBid.teamName,
      remainingPoints: winningTeam.remainingPoints - currentBid.amount,
    });

    setMessage(
      `SOLD! ${soldPlayer.name} to ${currentBid.teamName} for ${currentBid.amount} points.`
    );

    setPlayerName("");
    setBasePrice("1");
    setBidAmount("1");
    setCurrentBid(null);
  };

  const handleUnsold = () => {
    if (!playerName.trim()) {
      setMessage("Enter a player name before marking UNSOLD.");
      return;
    }

    setHistory((previousHistory) => [
      {
        player: playerName.trim(),
        team: "No team",
        amount: currentBid?.amount ?? 0,
        status: "UNSOLD",
      },
      ...previousHistory,
    ]);

    setAuctionDisplay({
      status: "unsold",
      playerName: playerName.trim(),
      basePrice: Number(basePrice),
      currentBid: currentBid?.amount ?? 0,
      highestTeam: currentBid?.teamName ?? "",
      soldTo: "",
      remainingPoints: null,
    });

    setMessage(`${playerName.trim()} marked UNSOLD.`);

    setPlayerName("");
    setBasePrice("1");
    setBidAmount("1");
    setCurrentBid(null);
  };

  if (!loggedIn) {
    return (
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
    );
  }

  return (
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
            <span /> {connected ? "SERVER CONNECTED" : "SERVER OFFLINE"}
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
              Player name
              <input
                style={inputStyle}
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Enter player name"
                disabled={Boolean(currentBid)}
                required
              />
            </label>

            <label>
              Base price (points)
              <input
                style={inputStyle}
                type="number"
                min="1"
                max={MAX_PLAYER_BID}
                value={basePrice}
                onChange={(event) => {
                  setBasePrice(event.target.value);
                  setBidAmount(event.target.value);
                }}
                disabled={Boolean(currentBid)}
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
                disabled={Boolean(currentBid)}
              >
                <UserPlus size={17} /> Prepare Player
              </button>
            </div>
          </form>

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
              Bid amount (points)
              <input
                style={inputStyle}
                type="number"
                min={Number(basePrice) || 1}
                max={MAX_PLAYER_BID}
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value)}
              />
            </label>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button
                type="button"
                onClick={handlePlaceBid}
                style={{
                  ...actionButtonStyle,
                  background: "#f47b20",
                  width: "100%",
                  color: "#111",
                }}
              >
                <Gavel size={17} /> Place / Raise Bid
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
            <h2 style={{ margin: "10px 0", fontSize: "clamp(24px, 4vw, 38px)" }}>
              {playerName.trim() || "Waiting for player"}
            </h2>

            <p style={{ color: "#a7a8b3" }}>
              Base price: {basePrice || 0} points
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
                disabled={!currentBid || !playerName.trim()}
                style={{
                  ...actionButtonStyle,
                  background: "#218c55",
                  opacity: currentBid ? 1 : 0.45,
                }}
              >
                <CheckCircle size={18} /> SOLD
              </button>

              <button
                type="button"
                onClick={handleUnsold}
                disabled={!playerName.trim()}
                style={{
                  ...actionButtonStyle,
                  background: "#bd3843",
                  opacity: playerName.trim() ? 1 : 0.45,
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
                                (team.remainingPoints / team.initialPoints) * 100
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
                        <li key={`${player.name}-${index}`}>
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
                    <tr key={`${item.player}-${index}`}>
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
                              item.status === "SOLD" ? "#55d995" : "#ff747d",
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
  );
}

export default App;
