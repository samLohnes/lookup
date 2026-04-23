import { Button } from "@/components/ui/button";

interface Props {
  hero: "sky" | "earth";
  onChange: (hero: "sky" | "earth") => void;
}

export function HeroToggle({ hero, onChange }: Props) {
  return (
    <div className="flex gap-1" role="group" aria-label="Hero view">
      <Button
        variant={hero === "sky" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("sky")}
      >
        Sky
      </Button>
      <Button
        variant={hero === "earth" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("earth")}
      >
        Earth
      </Button>
    </div>
  );
}
