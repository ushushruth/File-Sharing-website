import { useRef, useState } from "react";
import 'react-toastify/dist/ReactToastify.css';
import { toast, Toaster } from 'react-hot-toast';
import SHA256 from "crypto-js/sha256";
import copyIcon from "./assets/copy-icon.png";


//chunkz size
const wifiChunk = 4 * 1024 * 1024;
const mobileChunk = 256 * 1024;
const ws_url = `wss://socketrelay-p2p.onrender.com/ws`;

export default function App() {
  //refs for status
  const [status, setStatus] = useState("Disconnected");
  // const [room, setRoom] = useState("nani");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  //socket ref
  const socketref = useRef<WebSocket | null>(null);
  const fileref = useRef<HTMLInputElement | null>(null);
  //chunkz ref
  const receivedchunkz = useRef<Blob[]>([]);
  const incomingfile = useRef<{ name: string; size: number; mimeType: string } | null>(null);
  const received = useRef<number>(0);

  const roomIdref = useRef<HTMLInputElement | null>(null);




  //random roomid
  const randomRoom = () => {
    const lyrics: string[] = ['wind', 'tobase', 'kokoro', 'moon', 'miete', 'kuru', 'tokei', 'jikkake', 'semaku', 'natta', 'yume', 'fuwafuwa', 'haran', 'banjou', 'pikapika', 'fantasy', 'kotae', 'itsuka', 'mita', 'konsato', 'toki', 'onnaj', 'machiwabita', 'hakobune', 'kimi', 'nosete', 'ikou', 'nagame', 'seshima', 'yoru', 'shijima', 'ukabi', 'nagara', 'mekuru', 'mekuwa', 'shirisugita', 'futari', 'atarashii', 'tabi', 'tojite', 'unazukeba', 'fukaku', 'tokete', 'upcoming', 'shows', 'tickets', 'your', 'favorite', 'artists', 'morning', 'drops', 'kids', 'school', 'thinking', 'sends', 'assistant', 'coffee', 'afternoon', 'around', 'knows', 'lives', 'daydreams', 'first', 'dont', 'know', 'takes', 'boat', 'imagines', 'sailing', 'telling', 'mates', 'wouldnt', 'memory', 'woman', 'sleeps', 'while', 'plays', 'pretend', 'where'];
    const random = lyrics[Math.floor(Math.random() * lyrics.length)];
    const randRoom = SHA256(random + Date.now()).toString().slice(0, 8);
    return randRoom;
  }
  const [room, setRoom] = useState(randomRoom);
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

  const handleFileChunkz = (blob: Blob) => {
    receivedchunkz.current.push(blob);
    received.current += blob.size;

    if (incomingfile.current) {
      setProgress((received.current / incomingfile.current.size) * 100);
    }
  };

  const save = () => {
    if (!incomingfile.current) return;

    const blob = new Blob(receivedchunkz.current, { type: incomingfile.current.mimeType });
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
      setStatus(`Connected to ${room}!!!! :>`);
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

  //main fn
  const sendFile = async () => {
    const file = selectedFile;
    const socket = socketref.current;

    const currentChunkSize = isMobileMode ? mobileChunk : wifiChunk;
    //buffer size
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
      size: file.size,
      mimeType: file.type
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
      //progress bar update
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
  //drag and drop
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

  //copy text
  const copyText = () => {
    if (roomIdref.current) {
      navigator.clipboard.writeText(roomIdref.current.value);
      toast.success("Room ID Copied");

    }
  };

  // //random roomid
  // const randomRoom=()=>{
  //   const lyrics: string[] = ['wind','tobase','kokoro','moon','miete','kuru','tokei','jikkake','semaku','natta','yume','fuwafuwa','haran','banjou','pikapika','fantasy','kotae','itsuka','mita','konsato','toki','onnaj','machiwabita','hakobune','kimi','nosete','ikou','nagame','seshima','yoru','shijima','ukabi','nagara','mekuru','mekuwa','shirisugita','futari','atarashii','tabi','tojite','unazukeba','fukaku','tokete','upcoming','shows','tickets','your','favorite','artists','morning','drops','kids','school','thinking','sends','assistant','coffee','afternoon','around','knows','lives','daydreams','first','dont','know','takes','boat','imagines','sailing','telling','mates','wouldnt','memory','woman','sleeps','while','plays','pretend','where'];
  //   const random=lyrics[Math.floor(Math.random()*lyrics.length)];
  //   const randRoom= SHA256(random).toString().slice(0,8);
  //   return randRoom;
  // }
  const isTransferring = sending || (progress > 0 && progress < 100);

  return (

    <div className="radiant-bg">
      <Toaster position="top-center" reverseOrder={false} />
      {isTransferring && (
        <img
          src="https://examplefile.com/images/downloaded.gif"
          alt="Transferring"
          className="transfer-gif"
        />
      )}
      <div className="app-container">
        <h2>Share Files</h2>



        <div className="controls-row">


          <div style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '2px solid #333',
            width: 'auto',
            minWidth: '300px',
            paddingBottom: '5px'
          }}>
            <input
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '2rem',
                fontWeight: 700,
                color: '#fff',
                width: '100%',
                textAlign: 'center',
                outline: 'none',
                fontFamily: 'inherit',

              }}
              type="text"
              value={room}
              ref={roomIdref}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="ENTER ROOM ID"
            />
            <button
              className="copyButton"
              onClick={copyText}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0 0 0 10px',
                transition: 'transform 0.2s',
                marginLeft: '10px',
                marginBottom: '10px',

              }}
              title="Copy Room ID"
            >
              <img src={copyIcon} alt="Copy" style={{ width: "24px", height: "24px", filter: "invert(1)" }} />
            </button>
          </div>
          <div className="liquid-radio-group" style={{ transform: "translateY(-5px)", marginBottom: '45px' }}>
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
              <span className="checkmark" ></span>
              Mobile Data
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '100%', marginBottom: '40px' }}>
          <button onClick={connect} className="liquid-btn" style={{ width: '100%' }}>
            {status.includes("Connected") ? "SWITCH ROOM" : "CONNECT"}
          </button>
        </div>

        {/* <div className="liquid-radio-group" style={{ marginBottom: "20px" }}>
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
        </div> */}

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