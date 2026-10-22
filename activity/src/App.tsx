import * as React from "react";
import { GitHubActivityGrid, type ActivityDay } from "@/components/ui/github-activity-grid";
import { fetchPublicDays } from "@/data";

const LOGIN = "emrebarkind";

export default function App() {
  const [days, setDays] = React.useState<ActivityDay[] | undefined>(window.__ACTIVITY__);

  React.useEffect(() => {
    if (days) return;
    fetchPublicDays(LOGIN).then(setDays).catch(console.error);
  }, [days]);

  return (
    <main id="card" className="w-[820px] p-6">
      {days && <GitHubActivityGrid days={days} cellSize={12} cellGap={3} />}
    </main>
  );
}
