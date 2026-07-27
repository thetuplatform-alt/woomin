import { readFileSync } from "node:fs";
import { join } from "node:path";

const playerSource = readFileSync(
  join(process.cwd(), "components/main/player/video-player.tsx"),
  "utf8"
);

describe("影片播放器播放契約", () => {
  it("所有來源都不自動播放", () => {
    expect(playerSource).toContain("autoplay: 0");
    expect(playerSource).toContain("autoplay={false}");
    expect(playerSource).toContain('searchParams.set("autoplay", "false")');
  });

  it("使用者按下播放後不會被程式強制靜音", () => {
    expect(playerSource).toContain("useState(1)");
    expect(playerSource).toContain("useState(100)");
    expect(playerSource).toContain("useState(false)");
    expect(playerSource).not.toContain("event.target.mute();");
    expect(playerSource).not.toContain("event.target.setVolume(0);");
    expect(playerSource).not.toContain("await player.setMuted(true);");
    expect(playerSource).not.toContain('searchParams.set("muted", "true")');
    expect(playerSource).not.toMatch(/<Stream[\s\S]*?\n\s+muted\n/);
  });
});
