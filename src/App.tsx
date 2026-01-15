import { useRef, useState } from "react";

const wifiChunk = 4 * 1024 * 1024;
const mobileChunk = 256 * 1024;
const ws_url = `wss://socketrelay-p2p.onrender.com/ws`;

export default function App() {
  const [status, setStatus] = useState("Disconnected");
  const [room, setRoom] = useState("room67");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const socketref = useRef<WebSocket | null>(null);
  const fileref = useRef<HTMLInputElement | null>(null);

  const receivedchunkz = useRef<ArrayBuffer[]>([]);
  const incomingfile = useRef<{ name: string; size: number; receivedSize: number } | null>(null);
  const received = useRef<number>(0);

  const handleSignalMsz = (data: string) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "META") {
        incomingfile.current = msg;
        receivedchunkz.current = [];
        received.current = 0;
        setProgress(0);
        setStatus(`Receiving a sus file from bro: ${msg.name}...`);
      } else if (msg.type === "DONE") {
        save();
      }
    } catch (err) {
    }
  };

  const handleFileChunkz = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    receivedchunkz.current.push(arrayBuffer);
    received.current += arrayBuffer.byteLength;

    if (incomingfile.current) {
      setProgress((received.current / incomingfile.current.size) * 100);
    }
  };

  const save = () => {
    if (!incomingfile.current) return;

    const blob = new Blob(receivedchunkz.current);
    const link = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = link;
    a.download = incomingfile.current.name;
    a.click();

    setStatus("DOWNLOADED!! :>");
    incomingfile.current = null;
    receivedchunkz.current = [];
    received.current = 0;
    setProgress(0);
  };

  const wait = (socket: WebSocket) => {
    return new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (socket.bufferedAmount < 64 * 1024) {
          clearInterval(check);
          resolve();
        }
      }, 5);
    });
  };

  const connect = () => {
    if (socketref.current) {
      socketref.current.close();
      socketref.current = null;
    }
    setStatus("connecting....... :| :/");
    const socket = new WebSocket(ws_url);

    socketref.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "JOIN", roomID: room }));
      setStatus("Connected to bros room!!!! :>");
    };

    socket.onmessage = (e) => {
      if (e.data instanceof Blob) {
        handleFileChunkz(e.data);
      } else {
        handleSignalMsz(e.data);
      }
    };

    socket.onclose = () => {
      if (socketref.current === socket) {
        setStatus("Disconnected from bro!!! :<");
        socketref.current = null;
      }
    };
  };

  const sendFile = async () => {
    const file = selectedFile;
    const socket = socketref.current;

    const currentChunkSize = isMobileMode ? mobileChunk : wifiChunk;
    const bufferLimit = isMobileMode ? 1024 * 1024 : 12 * 1024 * 1024;

    if (!file) {
      return alert("Please select a file first.");
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connect();
      return alert("Connection lost. Reconnecting...");
    }

    setSending(true);
    setProgress(0);

    const metaData = JSON.stringify({
      type: "META",
      roomID: room,
      name: file.name,
      size: file.size
    });

    socket.send(metaData);

    let offset = 0;
    let lastPercent = 0;

    while (offset < file.size) {
      const slice = file.slice(offset, offset + currentChunkSize);
      const buffer = await slice.arrayBuffer();

      if (socket.bufferedAmount > bufferLimit) {
        await wait(socket);
      }

      socket.send(buffer);
      offset += buffer.byteLength;

      const percent = (offset / file.size) * 100;

      if (percent - lastPercent >= 1 || percent === 100) {
        setProgress(percent);
        lastPercent = percent;
        await new Promise(r => setTimeout(r, 0));
      }
    }

    socket.send(JSON.stringify({ type: "DONE", roomID: room }));
    setSending(false);
    setStatus("Sent Successfully!");
    setSelectedFile(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleZoneClick = () => {
    fileref.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  return (
    <div className="radiant-bg">
      <div className="app-container">
        <h2>Share Files</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '100%', marginBottom: '40px' }}>
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="ENTER ROOM ID"
          />
          <button onClick={connect} className="liquid-btn" style={{ width: '100%' }}>
            {status.includes("Connected") ? "SWITCH ROOM" : "CONNECT"}
          </button>
        </div>

        <div className="liquid-radio-group" style={{ marginBottom: "20px" }}>
          <label className="liquid-radio">
            <input
              type="radio"
              name="network"
              checked={!isMobileMode}
              onChange={() => setIsMobileMode(false)}
            />
            <span className="checkmark"></span>
            WiFi
          </label>
          <label className="liquid-radio">
            <input
              type="radio"
              name="network"
              checked={isMobileMode}
              onChange={() => setIsMobileMode(true)}
            />
            <span className="checkmark"></span>
            Mobile Data
          </label>
        </div>

        <div className="status-text">
          {status}
        </div>

        <div style={{ width: '100%', height: '20px', backgroundColor: '#e0e0e0', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#4CAF50',
            transition: 'width 0.1s linear'
          }} />
        </div>
        <p>{progress.toFixed(1)}%</p>

        <div style={{ width: '100%' }}>
          <div
            className={`drop-zone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleZoneClick}
          >
            <input
              ref={fileref}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <p className={selectedFile ? "file-name-text" : ""}>
              {selectedFile
                ? `📄 ${selectedFile.name}`
                : "Drag & drop files here or click to browse"}
            </p>
          </div>
          <button
            onClick={sendFile}
            disabled={sending}
            className="liquid-btn"
            style={{ width: '100%' }}
          >
            {sending ? "Sending..." : "Send File"}
          </button>
        </div>
      </div>
    </div>
  );
}