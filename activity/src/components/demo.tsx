"use client";

import * as React from "react";
import { GitHubActivityGrid, mockActivityYear } from "@/components/ui/github-activity-grid";

const settings = {
  seed: 2026,
  cellSize: 11,
  cellGap: 3,
};

export default function Demo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const days = React.useMemo(() => mockActivityYear(s.seed), [s.seed]);

  return (
    <div className="flex min-h-[360px] w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <GitHubActivityGrid days={days} cellSize={s.cellSize} cellGap={s.cellGap} />
      </div>
    </div>
  );
}
