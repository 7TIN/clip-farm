import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadDancing } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";

const fontMap: Record<string, string> = {
  Inter: loadInter().fontFamily,
  "Playfair Display": loadPlayfair().fontFamily,
  "Dancing Script": loadDancing().fontFamily,
  Oswald: loadOswald().fontFamily,
  Merriweather: loadMerriweather().fontFamily,
  Pacifico: loadPacifico().fontFamily,
};

export function resolveFontFamily(displayName: string): string {
  return fontMap[displayName] ?? fontMap.Inter;
}
