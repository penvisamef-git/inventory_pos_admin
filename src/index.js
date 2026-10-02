import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./page/theme/themes.css";
import RouteComponent from "./routes/route.component";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <RouteComponent />
  </React.StrictMode>
);

reportWebVitals();
