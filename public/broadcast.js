(() => {
  const sourceSelect = document.getElementById("source");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const setupView = document.getElementById("setup-view");
  const liveView = document.getElementById("live-view");
  const roomCodeEl = document.getElementById("room-code");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const errorBox = document.getElementById("error-box");
  const visualizer = document.getElementById("visualizer");

  const BAR_COUNT = 28;
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement("span");
    bar.style.height = "3px";
    visualizer.appendChild(bar);
  }
  const bars = Array.from(visualizer.children);

  let pc = null;
  let stream = null;
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

  async function getAudioStream(source) {
    if (source === "mic") {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
    // Screen/tab share is the only way browsers expose system or tab audio.
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      throw new Error(
        "No audio track was shared. Re-run and enable \"Share tab audio\" / \"Share system audio\".",
      );
    }
    displayStream.getVideoTracks().forEach((t) => t.stop());
    return new MediaStream(audioTracks);
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
      if (!res.ok) return;
      const room = await res.json();

      if (room.answer && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(room.answer);
      }

      const listenerCandidates = room.listenerCandidates || [];
      for (let i = lastCandidateCount; i < listenerCandidates.length; i++) {
        try {
          await pc.addIceCandidate(listenerCandidates[i]);
        } catch (err) {
          console.warn("Failed to add ICE candidate", err);
        }
      }
      lastCandidateCount = listenerCandidates.length;
    } catch (err) {
      console.warn("Poll failed", err);
    }
  }

  async function start() {
    clearError();
    startBtn.disabled = true;
    startBtn.textContent = "Starting…";

    try {
      stream = await getAudioStream(sourceSelect.value);

      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && roomCode) {
          fetch(`/api/rooms/${roomCode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "candidate",
              role: "broadcaster",
              candidate: event.candidate,
            }),
          }).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") {
          setStatus("connected", "Phone connected — audio is streaming.");
        } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setStatus("error", "Connection lost. Stop and start again if needed.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer }),
      });
      if (!res.ok) throw new Error("Could not create a room. Try again.");
      const data = await res.json();
      roomCode = data.code;

      roomCodeEl.textContent = roomCode;
      setupView.style.display = "none";
      liveView.style.display = "block";
      setStatus("connecting", "Waiting for the phone to connect…");
      startVisualizer(stream);

      pollTimer = setInterval(pollRoom, 1500);
    } catch (err) {
      console.error(err);
      showError(err.message || "Could not start broadcasting.");
      startBtn.disabled = false;
      startBtn.textContent = "Start broadcasting";
      if (stream) stream.getTracks().forEach((t) => t.stop());
    }
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    stopVisualizer();
    if (pc) {
      pc.close();
      pc = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    roomCode = null;
    lastCandidateCount = 0;
    liveView.style.display = "none";
    setupView.style.display = "block";
    startBtn.disabled = false;
    startBtn.textContent = "Start broadcasting";
    setStatus(null, "Waiting for the phone to connect…");
  }

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);
  window.addEventListener("beforeunload", stop);
})();
