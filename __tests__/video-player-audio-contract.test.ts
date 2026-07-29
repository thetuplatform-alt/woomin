import { readFileSync } from "node:fs";
import { join } from "node:path";

const playerSource = readFileSync(
  join(process.cwd(), "components/main/player/unified-video-player.tsx"),
  "utf8"
);

describe("影片播放器播放契約", () => {
  it("所有來源都不自動播放", () => {
    expect(playerSource).toContain('load="eager"');
    expect(playerSource).toContain("playsInline");
    expect(playerSource).not.toContain("autoplay={true}");
  });

  it("使用者按下播放後不會被程式強制靜音", () => {
    expect(playerSource).toContain("onPlay={onPlay}");
    expect(playerSource).toContain("onPause={onPause}");
    expect(playerSource).toContain("onEnded={onEnded}");
    expect(playerSource).not.toContain("event.target.mute();");
    expect(playerSource).not.toContain("event.target.setVolume(0);");
    expect(playerSource).not.toContain("await player.setMuted(true);");
    expect(playerSource).not.toContain('searchParams.set("muted", "true")');
    expect(playerSource).not.toMatch(/<Stream[\s\S]*?\n\s+muted\n/);
  });
});
