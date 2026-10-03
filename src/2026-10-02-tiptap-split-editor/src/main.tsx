import React from "react"
import ReactDOM from "react-dom/client"

import { App } from "./app"

// formula styles and fonts, used by the editor's math fields and by the
// markup MathLive renders into the previews
import "mathlive/static.css"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
