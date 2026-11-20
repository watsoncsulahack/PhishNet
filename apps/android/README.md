# PhishNet Android preview

Native Kotlin + Jetpack Compose. Android 9 or later; no Node server required.

## Try it on your phone

1. Download the APK artifact from a successful **Android preview** GitHub Actions run. Unzip and install the APK; allow installation from your browser/file manager if Android asks.
2. Read the test-wallet warning, acknowledge it, then **Create test wallet**. Nothing is pre-funded or simulated.
3. **Copy address**, then **Open faucet**. On Circle's website select **Arc Testnet** and paste the address. Follow any sign-in, CAPTCHA, or rate-limit requirements there.
4. Return and **Check balance**. It reads native USDC from Arc's public JSON-RPC endpoint and checks chain ID 5042002. Balances are rounded down to two decimals; native Arc USDC uses 18 decimals, not the ERC-20 interface's 6.
5. Open **Assistant** for a local, rule-based guide. No chat messages are transmitted. This is not yet a general AI agent. It cannot obtain funds automatically, earn money, or spend.

Test funds have no cash value. Never send real assets. Keys have **no recovery/export** in this preview; deleting app data, uninstalling, or losing the device loses access. Debug builds use disposable CI signing keys and are not a stable release/update channel.

## Build

JDK 17 and Android SDK 35:

```sh
cd apps/android
./gradlew testDebugUnitTest lintDebug assembleDebug
# Optional: connected emulator or device
./gradlew connectedDebugAndroidTest
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.
GitHub Actions builds and uploads it, runs JVM tests and lint, and separately runs onboarding and encrypted-storage tests on an API 35 emulator. Device tests erase the test app's wallet storage; use only on a disposable test install.

## UX

Three tabs: Wallet, Assistant, Safety. Large controls, system font scaling, screen-reader labels, vertical scrolling at large text sizes, system animation scale support through Compose, soft transition animations, and plain-language disclosures. No externally hosted fonts or analytics. Manual TalkBack, large-font, reduced-motion and real-phone validation still required.

## Security boundary

The app is intentionally receive-only. It does not call the prototype payment API. Private keys are encrypted with AES-GCM under an Android Keystore key; the encryption key is non-exportable, but hardware backing varies by device. Wallet creation/decryption occurs off the UI thread. Screenshots and Android backup are disabled, and cleartext HTTP is disallowed. Addresses copied to the clipboard are public.

Before spending can ship: recovery design, authenticated transaction-specific confirmation, one independent deterministic gate shared with the signer, durable atomic budget/nonce bookkeeping, authenticated evidence, transaction simulation, accurate fee display, receipt confirmation, and security review. Do not expose the old API to real assets.
