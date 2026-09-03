"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("kardia-theme");
    if (saved === "light") { document.body.classList.add("theme-light"); setLight(true); }
  }, []);
  function toggle() {
    const next = !light;
    setLight(next);
    document.body.classList.toggle("theme-light", next);
    window.localStorage.setItem("kardia-theme", next ? "light" : "dark");
  }
  return <button className="icon-button" onClick={toggle} aria-label={`Switch to ${light ? "dark" : "light"} theme`} title={`Switch to ${light ? "dark" : "light"} theme`}>{light ? <Moon size={17} /> : <Sun size={17} />}</button>;
}
