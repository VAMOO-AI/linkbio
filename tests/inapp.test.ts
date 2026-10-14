import { describe, expect, test } from "vitest";
import { avisoInApp, ehInApp } from "../lib/inapp";

const ANDROID_IG =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.22.109 Android";
const IOS_IG =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 340.0.0.22.109";
const IOS_TIKTOK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 musical_ly_34.1.0";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36";

describe("inapp.ts", () => {
  test("detecta IG e TikTok, ignora navegador comum", () => {
    expect(ehInApp(ANDROID_IG)).toBe(true);
    expect(ehInApp(IOS_TIKTOK)).toBe(true);
    expect(ehInApp(CHROME_ANDROID)).toBe(false);
  });

  test("Android: intent:// que abre o Chrome na mesma URL", () => {
    const aviso = avisoInApp(ANDROID_IG, "https://link.exemplo.com/?utm_source=ig");
    expect(aviso?.intent).toBe(
      "intent://link.exemplo.com/?utm_source=ig#Intent;scheme=https;package=com.android.chrome;end",
    );
  });

  test("iOS: só instrução, sem intent", () => {
    const aviso = avisoInApp(IOS_IG, "https://link.exemplo.com/");
    expect(aviso?.intent).toBeNull();
    expect(aviso?.texto).toMatch(/Abrir no navegador/);
  });

  test("navegador comum: sem aviso", () => {
    expect(avisoInApp(CHROME_ANDROID, "https://link.exemplo.com/")).toBeNull();
  });
});
