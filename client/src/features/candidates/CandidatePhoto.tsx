import { useState } from "react";
import { webDocumentUrl } from "@validation";

export function CandidatePhoto({ name, photoUrl, previewUrl }: {
  name?: string | undefined; photoUrl?: string | undefined; previewUrl?: string | undefined;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = previewUrl || webDocumentUrl(photoUrl);
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("") || "—";
  return src && failed !== src
    ? <img className="nh-candidate-photo" src={src} alt={name ? "תמונה של " + name : "תמונת מועמד"}
        width={96} height={96} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
    : <span className="nh-candidate-photo nh-candidate-placeholder" role="img" aria-label="ללא תמונת מועמד">{initials}</span>;
}
