import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAgent } from "agents/react";

function App() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const add = (message: string) =>
    setLog((lines) => [...lines, `${new Date().toISOString()} ${message}`]);

  useAgent({
    agent: "repro-agent",
    name: "demo",
    onOpen: () => add("agent websocket connected"),
    onClose: () => add("agent websocket closed"),
    onMessage: (event) => add(`agent recv: ${event.data}`),
  });

  return (
    <main style={{ fontFamily: "monospace", padding: 16, maxWidth: 1100 }}>
      <h1>scuffi/flue #1 — nested Promise result</h1>
      <p>
        <strong>Expected:</strong> nested promises are deep-resolved before RPC,
        or the executor returns a corrective serialization error.
      </p>
      <p>
        <strong>Reported actual:</strong> the executor rejects with the raw
        transport error <code>DataCloneError: #&lt;Promise&gt; could not be cloned.</code>
      </p>
      <button
        disabled={running}
        onClick={async () => {
          setRunning(true);
          add("trigger: GET /repro");
          try {
            const response = await fetch("/repro", { cache: "no-store" });
            const text = await response.text();
            add(`HTTP ${response.status}`);
            try {
              add(JSON.stringify(JSON.parse(text), null, 2));
            } catch {
              add(text);
            }
          } catch (error) {
            add(`browser fetch failed: ${String(error)}`);
          } finally {
            setRunning(false);
          }
        }}
      >
        {running ? "Running…" : "Trigger bug"}
      </button>
      <p>
        The response also runs a <code>Promise.all</code> control; it should
        return <code>{`{"files":["a","b"]}`}</code> normally.
      </p>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {log.join("\n")}
      </pre>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
