import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
// Inter (variable) gồm đủ subset latin, latin-ext và vietnamese để hiển thị đúng tiếng Việt.
// Ban them ban "italic" that: neu chi nap wght.css, trinh duyet se "faux italic"
// (tu nghieng gia lap) lam dau tieng Viet nhu "Ă", "Â", "Đ", "Ơ", "Ư" lech va mat dau.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/inter/wght-italic.css";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
