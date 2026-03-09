import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import DevCycleProvider from "@devcycle/openfeature-web-provider";
import { OpenFeature } from "@openfeature/web-sdk";

async function bootstrap() {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  // Initialize DevCycle OpenFeature provider
  const devcycleProvider = new DevCycleProvider(
    import.meta.env.VITE_DEVCYCLE_CLIENT_SDK_KEY || ""
  );

  // Set the OpenFeature context based on your authenticated user later;
  // for now we just use an anonymous context to avoid blocking startup.
  await OpenFeature.setContext({ user_id: "anonymous" });
  await OpenFeature.setProviderAndWait(devcycleProvider);

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
