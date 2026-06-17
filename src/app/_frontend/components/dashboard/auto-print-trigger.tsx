"use client";

import { useEffect } from "react";

export function AutoPrintTrigger() {
  useEffect(() => {
    window.print();
  }, []);

  return null;
}
