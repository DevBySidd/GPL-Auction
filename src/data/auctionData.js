
export const INITIAL_POINTS = 250;

export const MAX_PLAYER_BID = 50;

export const TEAM_NAMES = [
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

export const INITIAL_TABLES = TEAM_NAMES.map((name, index) => ({
  id: index + 1,
  name,
  initialPoints: INITIAL_POINTS,
  remainingPoints: INITIAL_POINTS,
  players: [],
}));

export const AUCTIONEER = {
  username: "Gpl",
  password: "Gpl12",
};
