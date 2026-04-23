import { ResearchLayout } from "@/components/layout/research-layout";
import { useCursorReset } from "@/hooks/use-cursor-reset";
import { usePlaybackLoop } from "@/hooks/use-playback-loop";

// Task 10 will switch this based on app-mode.
// For now, always render research (M6 in progress — cinematic layout not built yet).
export default function App() {
  useCursorReset();
  usePlaybackLoop();
  return <ResearchLayout />;
}
