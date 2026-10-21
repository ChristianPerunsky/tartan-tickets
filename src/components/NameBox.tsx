"use client";

import { useEffect, useState } from "react";

import { NAME_COOKIE, normalizeName } from "../lib/session";

// Demo sign-in: a name typed into a text box, saved in a cookie as you type.
// It is NOT verified (anyone can type any name). Real sign-in is a non-goal.
export function NameBox() {
  const [name, setName] = useState("");

  // Read the saved name after the page loads (cookies are not available while
  // the server renders the page).
  useEffect(() => {
    const saved = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${NAME_COOKIE}=`));
    if (saved) {
      try {
        setName(decodeURIComponent(saved.slice(NAME_COOKIE.length + 1)));
      } catch {
        // Ignore a damaged cookie; the box just stays empty.
      }
    }
  }, []);

  function handleChange(value: string) {
    setName(value);
    const clean = normalizeName(value);
    // Valid name: remember it for 7 days. Empty/invalid: forget it.
    document.cookie = clean
      ? `${NAME_COOKIE}=${encodeURIComponent(clean)}; path=/; max-age=604800; SameSite=Lax`
      : `${NAME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }

  return (
    <div className="name-box">
      <label htmlFor="your-name">Your name</label>
      <input
        id="your-name"
        type="text"
        autoComplete="name"
        maxLength={60}
        value={name}
        onChange={(e) => handleChange(e.target.value)}
        aria-describedby="your-name-help"
      />
      <span id="your-name-help" className="note-inline">
        Needed to buy tickets. Demo only: your name is not verified.
      </span>
    </div>
  );
}
