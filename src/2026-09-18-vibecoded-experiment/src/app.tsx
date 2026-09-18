import { useState } from "react"

import { LearningJourneyBuilder } from "./screens/learning-journey-builder.tsx"
import { WorksheetBuilder } from "./screens/worksheet-builder.tsx"

import "./app.css"

type Story = "worksheet" | "learning-journey"

export default function App() {
  const [story, setStory] = useState<Story>("worksheet")

  return (
    <main className="storybook-shell">
      <nav className="storybook-nav" aria-label="Stories">
        <p className="eyebrow">Educational units</p>
        <h1>Storybook</h1>
        <button
          type="button"
          className={story === "worksheet" ? "active" : ""}
          onClick={() => setStory("worksheet")}
        >
          Worksheet
        </button>
        <button
          type="button"
          className={story === "learning-journey" ? "active" : ""}
          onClick={() => setStory("learning-journey")}
        >
          Learning journey
        </button>
      </nav>
      <div className="storybook-content">
        <div hidden={story !== "worksheet"}>
          <WorksheetBuilder />
        </div>
        <div hidden={story !== "learning-journey"}>
          <LearningJourneyBuilder />
        </div>
      </div>
    </main>
  )
}
