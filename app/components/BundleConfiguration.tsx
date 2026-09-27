"use client";

import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { BundlesPanel } from "./BundlesPanel";
import { BundleImageManager } from "./BundleImageManager";

export function BundleConfiguration(props: ComponentProps<typeof BundlesPanel>) {
  const [tab, setTab] = useState<"bundles" | "photos">("bundles");
  const [photosVisited, setPhotosVisited] = useState(false);
  const select = (next: "bundles" | "photos") => { setTab(next); if (next === "photos") setPhotosVisited(true); };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "bundles" : event.key === "End" ? "photos" : tab === "bundles" ? "photos" : "bundles";
    select(next);
    document.getElementById(`bundle-tab-${next}`)?.focus();
  };
  return <section>
    <div className="bundle-config-tabs" role="tablist" aria-label="Configuración de bundles">
      {(["bundles", "photos"] as const).map(value => <button type="button" role="tab" key={value} id={`bundle-tab-${value}`} aria-controls={`bundle-panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={navigate} onClick={() => select(value)}>{value === "bundles" ? "Bundles" : "Fotos para chats"}</button>)}
    </div>
    <div role="tabpanel" id="bundle-panel-bundles" aria-labelledby="bundle-tab-bundles" hidden={tab !== "bundles"} tabIndex={0}><BundlesPanel {...props} /></div>
    <div role="tabpanel" id="bundle-panel-photos" aria-labelledby="bundle-tab-photos" hidden={tab !== "photos"} tabIndex={0}>
      {photosVisited && <BundleImageManager active={tab === "photos"} packages={props.packages} onCreate={props.onCreateImageSet} onUpload={props.onUploadImage} />}
    </div>
  </section>;
}
