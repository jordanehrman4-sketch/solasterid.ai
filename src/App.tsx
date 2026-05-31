import { useState } from "react";
import { ApiKeyGate } from "./components/ApiKeyGate";
import { GrowthConsole } from "./components/GrowthConsole";

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);

  if (!apiKey) {
    return <ApiKeyGate onApiKeyReady={setApiKey} />;
  }

  return <GrowthConsole apiKey={apiKey} onClearKey={() => setApiKey(null)} />;
}
