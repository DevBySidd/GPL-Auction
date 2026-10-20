
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { io } from "socket.io-client";
import {
  Trophy,
  Radio,
  UserRound,
  Gavel,
  Zap,
  ChevronDown,
  Users,
  Coins,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import "./Display.css";

const SERVER_URL = "http://localhost:4000";

const DEFAULT_AUCTION = {
  status: "waiting",
  playerName: "",
  role: "",
  playerRole: "",
  basePrice: 0,
  currentBid: 0,
  highestTeam: "",
  soldTo: "",
};

function formatPoints(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function getPlayerName(player) {
  if (typeof player === "string") return player;

  return (
    player?.name ||
    player?.playerName ||
    player?.player ||
    "Unknown Player"
  );
}

function getPlayerPrice(player) {
  if (typeof player === "string") return null;

  const price =
    player?.purchasePrice ??
    player?.soldPrice ??
    player?.price ??
    player?.bid ??
    player?.amount;

  if (price === undefined || price === null || price === "") {
    return null;
  }

  return Number.isFinite(Number(price)) ? Number(price) : null;
}

function getPlayerCountLabel(count) {
  return `${count} ${count === 1 ? "PLAYER" : "PLAYERS"}`;
}

export default function Display() {
  const [auction, setAuction] = useState(DEFAULT_AUCTION);
  const [teams, setTeams] = useState([]);
  const [expandedTeams, setExpandedTeams] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("auction-update", (newState) => {
      if (!newState || typeof newState !== "object") return;

      setAuction((previous) => ({
        ...previous,
        ...newState,
      }));
    });

    socket.on("auction-overview", (overview) => {
      if (!overview || !Array.isArray(overview.teams)) return;

      setTeams(overview.teams);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const toggleTeam = (teamId) => {
    setExpandedTeams((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    );
  };

  const status = String(auction.status || "waiting").toLowerCase();

  const isSold = status === "sold";
  const isUnsold = status === "unsold";
  const isBidding = status === "bidding";
  const isWaiting = status === "waiting";

  const statusLabel = isSold
    ? "SOLD!"
    : isUnsold
      ? "UNSOLD"
      : isBidding
        ? "BIDDING IN PROGRESS"
        : "WAITING FOR NEXT PLAYER";

  const role = auction.role || auction.playerRole || "Player";

  const totalPlayers = teams.reduce(
    (total, team) =>
      total + (Array.isArray(team.players) ? team.players.length : 0),
    0
  );

  const totalRemaining = teams.reduce(
    (total, team) => total + Number(team.remainingPoints || 0),
    0
  );

  const totalBudget = teams.reduce(
    (total, team) => total + Number(team.initialPoints ?? 250),
    0
  );

  return (
    <main className="display-page">
      <div className="display-grid" />

      <header className="display-header">
        <div className="display-brand">
          <div className="display-logo">
            <Trophy size={30} />
          </div>

          <div>
            <p className="display-eyebrow">
              GARLGUNJI PREMIER LEAGUE
            </p>

            <h1>
              GPL <span>AUCTION</span>
            </h1>
          </div>
        </div>

        <div className={`display-live ${connected ? "is-connected" : ""}`}>
          {connected ? <Wifi size={17} /> : <WifiOff size={17} />}

          <span>
            {connected ? "CONNECTED LIVE" : "CONNECTING..."}
          </span>
        </div>
      </header>

      {/* LIVE AUCTION */}
      <section className="public-player-screen">
        <div className="public-section-heading">
          <Gavel size={21} />
          <h2>LIVE AUCTION</h2>

          {isBidding && (
            <span className="auction-live-tag">LIVE</span>
          )}
        </div>

        {isWaiting ? (
          <motion.div
            className="display-waiting"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Trophy size={70} strokeWidth={1.2} />

            <p className="display-eyebrow">THE STAGE IS SET</p>

            <h2>AWAITING NEXT PLAYER</h2>

            <p className="waiting-description">
              The auction will begin shortly.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${auction.playerName}-${status}`}
              className="player-auction"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <section className="player-panel">
                <div className="player-portrait">
                  <UserRound size={76} strokeWidth={1} />
                  <span className="portrait-caption">GPL PLAYER</span>
                </div>

                <p className="display-eyebrow">
                  PLAYER ON THE BLOCK
                </p>

                <h2 className="player-name">
                  {auction.playerName || "PLAYER NAME"}
                </h2>

                <p className="public-player-role">{role}</p>

                <div className="base-price">
                  <span>BASE PRICE</span>

                  <strong>
                    {formatPoints(auction.basePrice)} <small>PTS</small>
                  </strong>
                </div>
              </section>

              <section className="bid-panel">
                <div className="bid-panel-heading">
                  <Radio size={21} />
                  <span>AUCTION STATUS</span>
                </div>

                <div className={`public-auction-status ${status}`}>
                  {isBidding && <Zap size={22} />}
                  {statusLabel}
                </div>

                <p className="public-current-bid-label">
                  {isSold
                    ? "FINAL SOLD PRICE"
                    : isUnsold
                      ? "NO SALE"
                      : "CURRENT BID"}
                </p>

                <motion.div
                  key={auction.currentBid}
                  className="live-bid-value"
                  initial={{ scale: 1.06, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <span>{formatPoints(auction.currentBid)}</span>
                  <small>PTS</small>
                </motion.div>

                <div className="bid-divider" />

                <p className="winning-team-label">
                  {isSold ? "SOLD TO" : "BIDDING TEAM"}
                </p>

                <div className="winning-team">
                  <Trophy size={24} />

                  <strong>
                    {isSold
                      ? auction.soldTo || auction.highestTeam || "—"
                      : isBidding
                        ? auction.highestTeam || "WAITING FOR BID"
                        : isUnsold
                          ? "NO WINNING TEAM"
                          : "—"}
                  </strong>
                </div>
              </section>
            </motion.div>
          </AnimatePresence>
        )}

        {!isWaiting && (
          <motion.div
            key={status}
            className={`public-result-banner ${status}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {isSold
              ? "★  SOLD  ★"
              : isUnsold
                ? "UNSOLD"
                : isBidding
                  ? "●  BIDDING LIVE"
                  : statusLabel}
          </motion.div>
        )}
      </section>

      {/* TEAMS OVERVIEW */}
      <section className="public-teams-section">
        <div className="public-section-heading">
          <Users size={22} />
          <h2>TEAMS OVERVIEW</h2>

          <span className="team-count">
            {teams.length} TEAMS
          </span>
        </div>

        <div className="public-summary-stats">
          <div className="public-summary-card">
            <Users size={20} />

            <div>
              <span>TOTAL TEAMS</span>
              <strong>{teams.length}</strong>
            </div>
          </div>

          <div className="public-summary-card">
            <UserCheck size={20} />

            <div>
              <span>PLAYERS SOLD</span>
              <strong>{totalPlayers}</strong>
            </div>
          </div>

          <div className="public-summary-card">
            <Coins size={20} />

            <div>
              <span>POINTS REMAINING</span>
              <strong>{formatPoints(totalRemaining)}</strong>
              <small>of {formatPoints(totalBudget)}</small>
            </div>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="public-teams-empty">
            <Users size={36} />

            <h3>Waiting for team data</h3>

            <p>
              Team points and player lists will appear when the
              auction dashboard sends its overview.
            </p>
          </div>
        ) : (
          <div className="public-teams-grid">
            {teams.map((team) => {
              const players = Array.isArray(team.players)
                ? team.players
                : [];

              const initialPoints = Number(team.initialPoints ?? 250);
              const remainingPoints = Number(team.remainingPoints || 0);

              const spentPoints = Math.max(
                0,
                initialPoints - remainingPoints
              );

              const isExpanded = expandedTeams.includes(team.id);

              const spendPercentage =
                initialPoints > 0
                  ? Math.min(
                      100,
                      (spentPoints / initialPoints) * 100
                    )
                  : 0;

              return (
                <motion.article
                  key={team.id}
                  className={`public-team-card ${
                    isExpanded ? "expanded" : ""
                  }`}
                  layout
                >
                  <button
                    type="button"
                    className="public-team-card-button"
                    onClick={() => toggleTeam(team.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="public-team-topline">
                      <span className="public-team-number">
                        TEAM {String(team.id).padStart(2, "0")}
                      </span>

                      <span className="public-team-player-count">
                        <Users size={14} />
                        {getPlayerCountLabel(players.length)}
                      </span>
                    </div>

                    <h3 className="public-team-name">
                      {team.name}
                    </h3>

                    <div className="public-team-points">
                      <div>
                        <span>POINTS LEFT</span>
                        <strong>{formatPoints(remainingPoints)}</strong>
                      </div>

                      <div className="public-team-spent">
                        <span>SPENT</span>
                        <strong>{formatPoints(spentPoints)}</strong>
                      </div>
                    </div>

                    <div className="public-team-progress">
                      <span
                        style={{ width: `${spendPercentage}%` }}
                      />
                    </div>

                    <div className="public-team-expand-label">
                      <span>
                        {isExpanded ? "HIDE SQUAD" : "VIEW SQUAD"}
                      </span>

                      <ChevronDown
                        size={18}
                        className={isExpanded ? "rotated" : ""}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        className="public-team-squad"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <div className="public-squad-heading">
                          <h4>PLAYER SQUAD</h4>

                          <span>
                            {getPlayerCountLabel(players.length)}
                          </span>
                        </div>

                        {players.length === 0 ? (
                          <p className="public-squad-empty">
                            No players purchased yet.
                          </p>
                        ) : (
                          <div className="public-squad-list">
                            {players.map((player, index) => {
                              const playerName = getPlayerName(player);
                              const price = getPlayerPrice(player);

                              return (
                                <div
                                  className="public-squad-player"
                                  key={`${playerName}-${index}`}
                                >
                                  <span className="public-squad-index">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>

                                  <span className="public-squad-player-name">
                                    {playerName}
                                  </span>

                                  <strong className="public-squad-price">
                                    {price === null
                                      ? "—"
                                      : `${formatPoints(price)} PTS`}
                                  </strong>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="public-squad-total">
                          <span>TOTAL SPENT</span>

                          <strong>
                            {formatPoints(spentPoints)} PTS
                          </strong>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="display-footer">
        <span>GARLGUNJI PREMIER LEAGUE</span>
        <span>PLAY WITH PRIDE. BID FOR GLORY.</span>

        <span>
          GPL <b>2026</b>
        </span>
      </footer>
    </main>
  );
}
