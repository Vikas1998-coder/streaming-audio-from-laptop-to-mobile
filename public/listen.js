(() => {
  const codeInput = document.getElementById("code-input");
  const joinBtn = document.getElementById("join-btn");
  const leaveBtn = document.getElementById("leave-btn");
  const setupView = document.getElementById("setup-view");
  const liveView = document.getElementById("live-view");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const errorBox = document.getElementById("error-box");
  const audioEl = document.getElementById("audio-el");
  const visualizer = document.getElementById("visualizer");

  const BAR_COUNT = 28;
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement("span");
    bar.style.height = "3px";
    visualizer.appendChild(bar);
  }
  const bars = Array.from(visualizer.children);

  let pc = null;
  let pollTimer = null;
  let roomCode = null;
  let audioCtx = null;
  let rafId = null;
  let lastCandidateCount = 0;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("visible");
  }

  function clearError() {
    errorBox.classList.remove("visible");
  }

  function setStatus(state, text) {
    statusDot.className = "status-dot" + (state ? ` status-dot--${state}` : "");
    statusText.textContent = text;
  }

  function startVisualizer(mediaStream) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const src = audioCtx.createMediaStreamSource(mediaStream);
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < bars.length; i++) {
        const v = data[i % data.length] / 255;
        bars[i].style.height = `${Math.max(3, v * 56)}px`;
      }
      rafId = requestAnimationFrame(draw);
    }
    draw();
  }

  function stopVisualizer() {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioCtx) audioCtx.close().catch(() => {});
    bars.forEach((b) => (b.style.height = "3px"));
  }

  async function pollRoom() {
    try {
      const res = await fetch(`/api/rooms/${roomCode}`);
      if (!res.ok) {
        if (res.status === 404) {
          setStatus("error", "Room not found or has ended.");
        }
        return;
      }
      const room = await res.json();

      if (room.offer && pc.signalingState === "stable" && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(room.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await fetch(`/api/rooms/${roomCode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "answer", answer }),
        });
      }

      const broadcasterCandidates = room.broadcasterCandidates || [];
      for (let i = lastCandidateCount; i < broadcasterCandidates.length; i++) {
        try {
          await pc.addIceCandidate(broadcasterCandidates[i]);
        } catch (err) {
          console.warn("Failed to add ICE candidate", err);
        }
      }
      lastCandidateCount = broadcasterCandidates.length;
    } catch (err) {
      console.warn("Poll failed", err);
    }
  }

  async function join() {
    clearError();
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      showError("Enter the 6-digit code exactly as shown on the laptop.");
      return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = "Joining…";

    try {
      const check = await fetch(`/api/rooms/${code}`);
      if (!check.ok) throw new Error("That room code wasn't found.");

      roomCode = code;
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch(() => {
          setStatus("connecting", "Tap anywhere on the screen to start audio.");
        });
        startVisualizer(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && roomCode) {
          fetch(`/api/rooms/${roomCode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "candidate",
              role: "listener",
              candidate: event.candidate,
            }),
          }).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") {
          setStatus("connected", "Connected — streaming audio.");
        } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setStatus("error", "Connection lost.");
        }
      };

      setupView.style.display = "none";
      liveView.style.display = "block";
      setStatus("connecting", "Connecting to the laptop…");

      pollTimer = setInterval(pollRoom, 1500);
      pollRoom();
    } catch (err) {
      console.error(err);
      showError(err.message || "Could not join the room.");
      joinBtn.disabled = false;
      joinBtn.textContent = "Join room";
    }
  }

  function leave() {
    if (pollTimer) clearInterval(pollTimer);
    stopVisualizer();
    if (pc) {
      pc.close();
      pc = null;
    }
    audioEl.srcObject = null;
    roomCode = null;
    lastCandidateCount = 0;
    sentAnswer = false;
    liveView.style.display = "none";
    setupView.style.display = "block";
    joinBtn.disabled = false;
    joinBtn.textContent = "Join room";
    setStatus(null, "Connecting to the laptop…");
  }

  document.body.addEventListener("click", () => {
    if (audioEl.paused && audioEl.srcObject) {
      audioEl.play().catch(() => {});
    }
  });

  joinBtn.addEventListener("click", join);
  leaveBtn.addEventListener("click", leave);
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
  });
  window.addEventListener("beforeunload", leave);
})();
