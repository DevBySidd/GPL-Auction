
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function Intro({ onFinish }) {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [finished, setFinished] = useState(false);

  const finishIntro = () => {
    if (finished) return;

    setFinished(true);

    if (videoRef.current) {
      videoRef.current.pause();
    }

    onFinish();
  };

  useEffect(() => {
    const video = videoRef.current;

    if (video) {
      video.muted = true;

      video.play().catch(() => {
        // User can start playback manually if autoplay is blocked.
      });
    }
  }, []);

  const enableSound = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.muted = false;
      await video.play();
      setSoundEnabled(true);
    } catch {
      video.muted = true;
      setSoundEnabled(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      style={styles.overlay}
    >
      {!videoError ? (
        <video
          ref={videoRef}
          src="/gpl-intro.mp4"
          autoPlay
          muted={!soundEnabled}
          playsInline
          preload="auto"
          onEnded={finishIntro}
          onError={() => setVideoError(true)}
          style={styles.video}
        />
      ) : (
        <div style={styles.error}>
          <h1>GPL AUCTION</h1>
          <p>Intro video could not be loaded.</p>
          <p>Check that public/gpl-intro.mp4 exists.</p>
        </div>
      )}

      <div style={styles.topTitle}>
        <span style={styles.goldDot}>●</span>
        GARLGUNJI PREMIER LEAGUE
      </div>

      <div style={styles.bottomBar}>
        <div style={styles.brand}>
          <span style={styles.brandTitle}>GPL AUCTION</span>
          <span style={styles.subtitle}>
            THE GAME BEGINS HERE
          </span>
        </div>

        <div style={styles.controls}>
          <button
            type="button"
            onClick={enableSound}
            style={styles.soundButton}
          >
            {soundEnabled ? "🔊 Sound On" : "🔇 Enable Sound"}
          </button>

          <button
            type="button"
            onClick={finishIntro}
            style={styles.skipButton}
          >
            Skip Intro →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    background: "#05080d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
  },

  video: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    background: "#05080d",
  },

  topTitle: {
    position: "absolute",
    top: 26,
    left: 24,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 3,
    textShadow: "0 2px 12px #000",
  },

  goldDot: {
    color: "#e9bd4a",
    marginRight: 10,
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "35px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 20,
    background:
      "linear-gradient(transparent, rgba(0,0,0,0.9))",
  },

  brand: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  brandTitle: {
    color: "#f4cc62",
    fontSize: "clamp(25px, 5vw, 48px)",
    fontWeight: 900,
    letterSpacing: 2,
  },

  subtitle: {
    color: "#ffffff",
    fontSize: 11,
    letterSpacing: 4,
  },

  controls: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  soundButton: {
    padding: "12px 16px",
    border: "1px solid #e9bd4a",
    borderRadius: 8,
    background: "rgba(0,0,0,0.75)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
  },

  skipButton: {
    padding: "12px 18px",
    border: "none",
    borderRadius: 8,
    background: "#e9bd4a",
    color: "#111111",
    cursor: "pointer",
    fontWeight: 800,
  },

  error: {
    color: "#ffffff",
    textAlign: "center",
    padding: 24,
  },
};
