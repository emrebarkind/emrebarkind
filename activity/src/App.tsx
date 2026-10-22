import { GitHubActivity } from "@/components/ui/github-activity";

const LOGIN = "emrebarkind";

export default function App() {
  return (
    <main id="card" className="inline-block p-2">
      <GitHubActivity username={LOGIN} variant="lime" months={12} showMonths />
    </main>
  );
}
