"use client";

import { useState } from "react";

export function MeetingNotes({ meetingId, initial }: { meetingId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(true);

  async function save() {
    await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaved(true);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Notes de séance</div>
        {!saved && (
          <button className="text-xs text-ink underline" onClick={save}>
            Enregistrer
          </button>
        )}
      </div>
      <textarea
        className="input"
        rows={6}
        placeholder="Sujet, discussion, points abordés…"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
      />
    </div>
  );
}
