import { useRef, useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const socketRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingIceCandidatesRef = useRef({});
  const speakingIntervalRef = useRef(null);
  const statsIntervalRef = useRef(null);

  const [userName, setUserName] = useState('user1');
  const [room, setRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [serverUrl, setServerUrl] = useState("/ws");
  const [stats, setStats] = useState({
    bitrateKbps: 0,
    packetLost: 0,
    jitterMs: 0,
    roundTripTimeMs: 0,
  });
  const [iceConnectionState, setIceConnectionState] = useState("new");
  const [connectionState, setConnectionState] = useState("new");
  const [candidateType, setCandidateType] = useState("unknown");
  const [roomUsers, setRoomUsers] = useState([]);

  const userNameRef = useRef(userName);
  const roomRef = useRef(room);
  const mutedRef = useRef(muted);
  const deafenedRef = useRef(deafened);
  const speakingRef = useRef(speaking);

  useEffect(() => {
    userNameRef.current = userName;
    roomRef.current = room;
    mutedRef.current = muted;
    deafenedRef.current = deafened;
    speakingRef.current = speaking;
  }, [userName, room, muted, deafened, speaking]);

  function addMessage(message) {
    setMessages(prevMessages => [...prevMessages, message]);
  }

  function resolveWebSocketUrl(rawUrl) {
    if (rawUrl.startsWith("ws://") || rawUrl.startsWith("wss://")) {
      return rawUrl;
    }

    const path = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:8080${path}`;
  }

  function connectWebSocket() {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const socket = new WebSocket(resolveWebSocketUrl(serverUrl.trim()));

    socket.onopen = () => {
      setConnected(true);
      addMessage('Connected to signaling server');
    };

    socket.onmessage = async (event) => {
      addMessage(`Server: ${event.data}`);
      const message = JSON.parse(event.data);

      if (Array.isArray(message)) {
        setRoomUsers(message);
        return;
      }

      if (message.type === 'WEBRTC_OFFER') {
        await handleOffer(message);
      }

      if (message.type === 'WEBRTC_ANSWER') {
        await handleAnswer(message);
      }
      
      if (message.type === 'ICE_CANDIDATE') {
        await handleICECandidate(message);
      }

      if (message.type === 'PRESENCE_UPDATE') {
        addMessage(`Presence update from ${message.userName}: muted=${message.muted}, deafened=${message.deafened}, speaking=${message.speaking}`);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      addMessage('Disconnected from signaling server');
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };

    socket.onerror = (error) => {
      addMessage(`WebSocket error: ${error}`);
    };

    socketRef.current = socket;
  }

  function sendSignal(message) {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }

  function joinRoom() {
    const currentUserName = userName.trim();
    const currentRoom = room.trim();

    if (!currentUserName || !currentRoom) {
      addMessage('Username and room are required');
      return;
    }

    userNameRef.current = currentUserName;
    roomRef.current = currentRoom;

    sendSignal({
      type: 'JOIN_ROOM',
      userName: currentUserName,
      room: currentRoom
    });
    addMessage(currentUserName + ' requested to join room: ' + currentRoom);
  }

  function leaveRoom() {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addMessage('WebSocket is not connected');
      return;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    socketRef.current.send(JSON.stringify({
      type: 'LEAVE_ROOM',
      userName: userNameRef.current,
      room: roomRef.current
    }));
    addMessage(userNameRef.current + ' requested to leave room: ' + roomRef.current);
    
    // Clear out local peer states on leaving
    Object.keys(peerConnectionsRef.current).forEach((remoteUser) => {
      peerConnectionsRef.current[remoteUser].close();
      delete peerConnectionsRef.current[remoteUser];
      document.getElementById(`audio-${remoteUser}`)?.remove();
    });
    pendingIceCandidatesRef.current = {};
    setRoomUsers([]);
  }

  async function enableMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Microphone unavailable: browser requires a secure context (HTTPS or localhost) and camera/microphone permissions.';
      console.error(msg);
      addMessage(msg);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(track => {
        track.enabled = !mutedRef.current;
      });
      localStreamRef.current = stream;

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }
      setMicrophoneEnabled(true);
      addMessage('Microphone enabled');
      startSpeakingDetection(stream);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      addMessage(`Error accessing microphone: ${error.message || error}`);
    }
  }

  function disableMicrophone() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    localStreamRef.current = null;
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }

    setMicrophoneEnabled(false);
    addMessage('Microphone disabled');
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setSpeaking(false);
    sendPresenceUpdate(muted, deafened, false);

    Object.keys(peerConnectionsRef.current).forEach((remoteUser) => {
      peerConnectionsRef.current[remoteUser].close();
      delete peerConnectionsRef.current[remoteUser];
      document.getElementById(`audio-${remoteUser}`)?.remove();
    });
    pendingIceCandidatesRef.current = {};
  }

  function createPeerConnection(remoteUsername) {
    if (peerConnectionsRef.current[remoteUsername]) {
      return peerConnectionsRef.current[remoteUsername];
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:localhost:3478",
          username: "echolink",
          credential: "echolink123",
        },
      ],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: "ICE_CANDIDATE",
          from: userNameRef.current,
          to: remoteUsername,
          room: roomRef.current,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      addMessage("Remote audio track received from " + remoteUsername);
      
      let audio = document.getElementById(`audio-${remoteUsername}`);
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `audio-${remoteUsername}`;
        audio.autoplay = true;
        audio.playsInline = true;
        document.body.appendChild(audio);
      }
      
      audio.srcObject = event.streams[0];
      audio.muted = deafenedRef.current;

      audio.play()
        .then(() => addMessage("Audio started for " + remoteUsername))
        .catch(err => addMessage("Audio play failed: " + err.message));
    };

    peerConnection.oniceconnectionstatechange = () => {
      setIceConnectionState(peerConnection.iceConnectionState);
      addMessage("ICE state with " + remoteUsername + ": " + peerConnection.iceConnectionState);
    };

    peerConnection.onconnectionstatechange = () => {
      setConnectionState(peerConnection.connectionState);
      addMessage("Connection state with " + remoteUsername + ": " + peerConnection.connectionState);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionsRef.current[remoteUsername] = peerConnection;
    startStatsMonitoring(peerConnection);
    return peerConnection;
  }

  // Orchestrating connections dynamically via Perfect Negotiation triggers
  useEffect(() => {
    if (!microphoneEnabled || !connected || roomUsers.length === 0) {
      return;
    }

    // Tearing down stale connections
    Object.keys(peerConnectionsRef.current).forEach((remoteUser) => {
      if (!roomUsers.includes(remoteUser)) {
        addMessage(`${remoteUser} left the room. Tearing down connection.`);
        if (peerConnectionsRef.current[remoteUser]) {
          peerConnectionsRef.current[remoteUser].close();
          delete peerConnectionsRef.current[remoteUser];
        }
        const audioElem = document.getElementById(`audio-${remoteUser}`);
        if (audioElem) audioElem.remove();
      }
    });

    // Proactively establishing missing mesh connections
    roomUsers.forEach(async (remoteUser) => {
      const currentUserName = userNameRef.current;
      const currentRoom = roomRef.current;

      if (remoteUser === currentUserName) return;

      // Ensure a structural connection context exists for every other participant
      if (!peerConnectionsRef.current[remoteUser]) {
        try {
          const peerConnection = createPeerConnection(remoteUser);
          const shouldCreateOffer = currentUserName < remoteUser;

          if (!shouldCreateOffer) {
            addMessage("Waiting for offer from " + remoteUser);
            return;
          }

          if (peerConnection.signalingState !== "stable") {
            addMessage("Skipped offer to " + remoteUser + " because signaling state is " + peerConnection.signalingState);
            return;
          }

          const offer = await peerConnection.createOffer();

          if (peerConnection.signalingState !== "stable") {
            addMessage("Skipped offer to " + remoteUser + " because incoming signaling started");
            return;
          }

          await peerConnection.setLocalDescription(offer);

          sendSignal({
            type: "WEBRTC_OFFER",
            from: currentUserName,
            to: remoteUser,
            room: currentRoom,
            sdp: offer.sdp,
          });
          addMessage("Sent proactive offer to " + remoteUser);
        } catch (err) {
          console.error("Negotiation initiation failed for " + remoteUser, err);
        }
      }
    });
  }, [roomUsers, microphoneEnabled, connected]);

  function queueIceCandidate(remoteUsername, candidate) {
    if (!pendingIceCandidatesRef.current[remoteUsername]) {
      pendingIceCandidatesRef.current[remoteUsername] = [];
    }

    pendingIceCandidatesRef.current[remoteUsername].push(candidate);
  }

  async function flushQueuedIceCandidates(remoteUsername, peerConnection) {
    if (!peerConnection.remoteDescription) {
      return;
    }

    const pendingCandidates = pendingIceCandidatesRef.current[remoteUsername] || [];
    delete pendingIceCandidatesRef.current[remoteUsername];

    for (const candidate of pendingCandidates) {
      await peerConnection.addIceCandidate(candidate);
    }
  }

  async function handleOffer(message) {
    if (!localStreamRef.current) {
      addMessage("Received offer, but microphone is not enabled");
      return;
    }

    try {
      let peerConnection = peerConnectionsRef.current[message.from];
      if (!peerConnection) {
        peerConnection = createPeerConnection(message.from);
      }

      // Perfect Negotiation implementation tie-breaking rule
      const currentUserName = userNameRef.current;
      const currentRoom = roomRef.current;
      const isPolite = currentUserName > message.from;
      const glareCollision = peerConnection.signalingState !== "stable";

      if (glareCollision) {
        if (isPolite) {
          // Roll back local offer setup in favor of processing the incoming message cleanly
          await Promise.all([
            peerConnection.setLocalDescription({ type: "rollback" }),
            peerConnection.setRemoteDescription({ type: "offer", sdp: message.sdp })
          ]);
        } else {
          // Impolite peer drops the collision offer safely since its own offer takes priority
          addMessage(`Ignoring offer from ${message.from} due to collision handling.`);
          return;
        }
      } else {
        await peerConnection.setRemoteDescription({
          type: "offer",
          sdp: message.sdp,
        });
      }

      await flushQueuedIceCandidates(message.from, peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      sendSignal({
        type: "WEBRTC_ANSWER",
        from: currentUserName,
        to: message.from,
        room: currentRoom,
        sdp: answer.sdp,
      });

      addMessage("Processed offer and replied with answer to " + message.from);
    } catch (error) {
      addMessage("Error handling offer from " + message.from + ": " + error.message);
      console.error("handleOffer error:", error);
    }
  }

  async function handleAnswer(message) {
    const peerConnection = peerConnectionsRef.current[message.from];
    if (!peerConnection) {
      addMessage("No peer connection found for answer from " + message.from);
      return;
    }

    try {
      if (peerConnection.signalingState !== "have-local-offer") {
        addMessage("Signaling state stable or resolved already for: " + message.from);
        return;
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: message.sdp,
      });
      await flushQueuedIceCandidates(message.from, peerConnection);

      addMessage("Received and set answer from " + message.from);
    } catch (error) {
      addMessage("Error handling answer from " + message.from + ": " + error.message);
      console.error("handleAnswer error:", error);
    }
  }

  async function handleICECandidate(message) {
    const peerConnection = peerConnectionsRef.current[message.from];
    if (!peerConnection) {
      queueIceCandidate(message.from, message.candidate);
      addMessage("Queued ICE candidate until peer connection exists for " + message.from);
      return;
    }

    try {
      if (!peerConnection.remoteDescription) {
        queueIceCandidate(message.from, message.candidate);
        addMessage("Queued ICE candidate until remote description is set for " + message.from);
        return;
      }

      await peerConnection.addIceCandidate(message.candidate);
    } catch (error) {
      addMessage("Error adding ICE candidate from " + message.from + ": " + error.message);
      console.error("handleICECandidate error:", error);
    }
  }

  function sendPresenceUpdate(nextMuted, nextDeafened, nextSpeaking) {
    sendSignal({
      type: 'PRESENCE_UPDATE',
      userName: userNameRef.current,
      room: roomRef.current,
      muted: nextMuted,
      deafened: nextDeafened,
      speaking: nextSpeaking,
    });
  }

  function startSpeakingDetection(stream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    let lastSpeakingState = false;
    speakingIntervalRef.current = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      let total = 0;
      for (let i = 0; i < dataArray.length; i++) {
        total += dataArray[i];
      }

      const averageVolume = total / dataArray.length;
      const isSpeaking = averageVolume > 12;

      if (isSpeaking !== lastSpeakingState) {
        lastSpeakingState = isSpeaking;
        setSpeaking(isSpeaking);
        sendPresenceUpdate(mutedRef.current, deafenedRef.current, isSpeaking);
        addMessage("Speaking changed: " + isSpeaking);
      }
    }, 300);
  }

  function startStatsMonitoring(peerConnection) {
    let previousByteReceived = 0;
    let previousTimestamp = 0;

    statsIntervalRef.current = setInterval(async () => {
      if (peerConnection.signalingState === "closed") return;
      try {
        const reports = await peerConnection.getStats();

        reports.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            let bitrateKbps = 0;
            if (previousTimestamp > 0) {
              const bytesDelta = report.bytesReceived - previousByteReceived;
              const timeDeltaSeconds = (report.timestamp - previousTimestamp) / 1000;
              bitrateKbps = (bytesDelta * 8) / timeDeltaSeconds / 1000;
            }
            previousByteReceived = report.bytesReceived;
            previousTimestamp = report.timestamp;
            setStats((oldStats) => ({
              ...oldStats,
              bitrateKbps: Math.round(bitrateKbps),
              packetLost: report.packetLost || 0,
              jitterMs: report.jitter ? Math.round(report.jitter * 1000) : 0,
            }));
          }

          if (report.type === "candidate-pair" && report.state === "succeeded") {
            setStats((oldStats) => ({
              ...oldStats,
              roundTripTimeMs: report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : oldStats.roundTripTimeMs,
            }));
          }

          if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
            const localCandidate = reports.get(report.localCandidateId);
            if (localCandidate) {
              setCandidateType(localCandidate.candidateType);
            }
          }
        });
      } catch (e) {
        console.warn("Stats context unavailable for peer:", e);
      }
    }, 1000);
  }

  return (
    <main className={styles.container}>
      <h1>Echo Link</h1>
      <section className={styles.card}>
        <h2>Connection</h2>
        <label>Websocket server url</label>
        <input
          value={serverUrl}
          onChange={(event) => setServerUrl(event.target.value)}
        />
        <button onClick={connectWebSocket} disabled={connected}>Connect WebSocket</button>
        <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      </section>
      <section className={styles.card}>
        <h2>Room</h2>
        <input
          type="text"
          placeholder="Username"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />

        <input
          type="text"
          placeholder="Room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
        <button onClick={joinRoom} disabled={!connected}>
          Join Room
        </button>
        <button onClick={leaveRoom} disabled={!connected}>
          Leave Room
        </button>
        <section>
          <h2>Microphone</h2>
          <button onClick={enableMicrophone} disabled={microphoneEnabled}>
            Enable Microphone
          </button>
          <button onClick={disableMicrophone} disabled={!microphoneEnabled}>
            Disable Microphone
          </button>
          <p>Users in room: {roomUsers.join(", ")}</p>
          <button onClick={() => {
            const nextMuted = !muted;
            setMuted(nextMuted);
            mutedRef.current = nextMuted;
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach(track => {
                track.enabled = !nextMuted;
              });
            }
            sendPresenceUpdate(nextMuted, deafenedRef.current, speakingRef.current);
          }}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={() => {
            const nextDeafened = !deafened;
            setDeafened(nextDeafened);
            deafenedRef.current = nextDeafened;
            
            roomUsers.forEach((user) => {
              const audioElem = document.getElementById(`audio-${user}`);
              if (audioElem) audioElem.muted = nextDeafened;
            });
            
            sendPresenceUpdate(mutedRef.current, nextDeafened, speakingRef.current);
          }}>
            {deafened ? 'Undeafen' : 'Deafen'}
          </button>
          <p>Speaking: {speaking ? "yes" : "NO"}</p>
          <p>Microphone status: {microphoneEnabled ? 'Enabled' : 'Disabled'}</p>
        </section>
        <audio ref={localAudioRef} autoPlay muted></audio>
        <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }}></audio>
      </section>
      <section className={styles.card}>
        <h2>Messages</h2>
          {messages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
      </section>
      <section className={styles.card}>
        <h2>Network Metrics</h2>
        <p>ICE State: {iceConnectionState}</p>
        <p>Connection State: {connectionState}</p>
        <p>Candidate Type: {candidateType}</p>
        <p>Bitrate: {stats.bitrateKbps} Kbps</p>
        <p>Packet Loss: {stats.packetLost}</p>
        <p>Jitter: {stats.jitterMs} ms</p>
        <p>Round Trip Time: {stats.roundTripTimeMs} ms</p>
      </section>
    </main>
  );
}
