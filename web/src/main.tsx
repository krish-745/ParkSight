import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./index.css";
import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";
import App from "./App";

const theme = extendTheme({
  config: { initialColorMode: "dark", useSystemColorMode: false },
  fonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
  styles: {
    global: {
      body: { bg: "gray.900", color: "gray.100" },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ColorModeScript initialColorMode="dark" />
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </BrowserRouter>
  </StrictMode>
);
