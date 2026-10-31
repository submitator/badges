"use client";
// DO NOT COPY: a client component that fills the wall in useEffect. The page
// looks right in a browser, but the server HTML has no badge, so directories
// and our checks find nothing. The wall still travels in the page's data
// (with ?ref=<project id>), which is why the self-check looks for
// data-sbm-ref instead of ref=.
import { useEffect, useState } from "react";
import type { Wall } from "@submitator/badges";
import { BadgeWall } from "@submitator/badges/react";

export function ClientBadges({ wall }: { wall: Wall | null }) {
  const [shown, setShown] = useState<Wall | null>(null);
  useEffect(() => {
    setShown(wall);
  }, [wall]);
  return <BadgeWall wall={shown} />;
}
