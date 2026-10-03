"use client";

import { useId, useState } from "react";
import { Clock3, Info } from "lucide-react";
import { Offering, duration } from "@/lib/types";

export function ShowAddon({ show, checked, onChange, price }: {
  show: Offering;
  checked: boolean;
  onChange: (checked: boolean) => void;
  price?: string;
}) {
  const descriptionId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hovered || focused || pinned);

  return <div className="show-addon" onPointerLeave={() => setHovered(false)} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation();
      setPinned(false); setDismissed(true);
    }
  }}>
    <div className="show-addon-row">
      <label>
        <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
        <span className="show-addon-copy"><span className="show-addon-name">{show.name}</span>
          <span className="show-addon-duration"><Clock3 size={13} aria-hidden="true" />{show.duration_is_approximate && "≈ "}{duration(show.duration_minutes)}</span>
          {price && <small>{price}</small>}
        </span>
      </label>
      <div className="show-addon-info" onPointerEnter={event => {
        if (event.pointerType === "mouse") { setHovered(true); setDismissed(false); }
      }}>
        <button type="button" className="show-info-button" aria-label={`Описание: ${show.name}`}
          aria-expanded={open} aria-controls={descriptionId}
          onFocus={() => { setFocused(true); setDismissed(false); }}
          onBlur={() => { setFocused(false); setPinned(false); }}
          onClick={() => {
            if (pinned && !dismissed) { setPinned(false); setDismissed(true); }
            else { setPinned(true); setDismissed(false); }
          }}><Info size={18} aria-hidden="true" /></button>
      </div>
    </div>
    <div id={descriptionId} className="show-addon-description" hidden={!open}>
      <strong>{show.name}</strong><p>{show.description}</p>
    </div>
  </div>;
}
