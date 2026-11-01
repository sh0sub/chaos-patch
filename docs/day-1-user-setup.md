# D1 user setup guide

This checklist contains the account, consent, and desktop actions that require the project owner's direct involvement. Never paste access tokens, refresh tokens, client secrets, stream keys, API keys, or OAuth authorization codes into chat, screenshots, commits, or issue trackers.

## Current local status (2026-10-27)

- Node.js 22.12 or newer, pnpm 10, npm, Git, Codex CLI, and FFmpeg are installed.
- `OPENAI_API_KEY` is present in the environment. Its value has not been read or printed.
- The project uses an ignored `.env.local`; its values must never be printed, captured, or committed.
- OBS Studio 33.0.0 is installed at `/Applications/OBS.app`.
- Twitch email verification and two-factor authentication are complete.
- The Twitch developer application has been created as a confidential Game Integration.
- Devpost registration is complete.
- OBS has been launched and its initial permissions are ready.
- OpenAI API billing has $10 of credit and is ready for the smoke test.
- The current Twitch account is the broadcaster and demo channel for the MVP.
- `.env.example` and an ignored `.env.local` have been prepared for credentials.
- `scripts/setup-secrets.sh` provides hidden interactive entry for local credentials.
- Twitch Client ID and Client Secret are stored in `.env.local`; presence, redirect URI, file mode `600`, and Git-ignore behavior were verified without printing the values.
- The current Codex thread is the project thread and must not be forked.
- The current Twitch account is authorized with `user:read:chat` and `user:write:chat`.
- Twitch EventSub WebSocket reached `connected` and received a message sent through the Helix chat API.
- OpenAI structured-output compilation produced and applied a valid `PatchV1` in the local smoke test.
- OAuth tokens remain in server memory only. Restarting the server requires authorizing Twitch again.

## D1 verification result

The first vertical slice is working locally:

1. Open `http://localhost:5173` while `pnpm dev` is running.
2. Connect the current Twitch account.
3. The server exchanges the authorization code and subscribes to `channel.chat.message` over EventSub WebSockets.
4. A Helix chat message sent by the current account returns through EventSub and appears in **Chat wire**.
5. A rehearsal round accepts a patch idea, builds three candidates, records a vote, compiles a bounded `PatchV1` with OpenAI, and applies it to Emote Dodge.

Recommended evidence filename: `2026-10-27-d1-twitch-oauth-eventsub.mov`. Do not record `.env.local`, the Twitch developer console, browser address-bar query parameters, or terminal environment output.

## Required now — owner actions

### 1. Join and verify the hackathon

- Sign in to Devpost and confirm that this account has joined the Codex x TwitchCon Hackathon.
- Confirm that the entrant profile is an individual entry and that the account can open **Enter a Submission**.
- Do not submit yet; saving a draft later is allowed before the deadline.

Official rules: <https://twitchcon-codex.devpost.com/rules>

### 2. Prepare the Twitch broadcaster account

- Verify the Twitch account email.
- Enable two-factor authentication under Twitch Security and Privacy.
- Confirm that the account can start a live stream.
- Confirm that clips are enabled for the channel if automatic clip creation will be tested.
- Decide which broadcaster channel will be used for the demo.

Do not create or share a stream key in chat. OBS can be connected through Twitch account authorization later.

### 3. Register a Twitch developer application

Open the Twitch Developer Console and register one application for Chaos Patch.

- Use a unique application name. `Chaos Patch` may already be taken, so add a private suffix if needed.
- OAuth redirect URL: `http://localhost:3000/auth/callback`
- Select the closest available application category. The exact category is not mandated by the artifact or official registration guide.
- Create the application and record its Client ID.
- Generate a Client Secret for the Authorization Code flow and store it in a password manager until the local secret file is prepared.

The Client ID is public, but the Client Secret must be treated like a password. Do not paste either value into this Codex thread; the secret must never appear in screenshots or Git history.

Official registration guide: <https://dev.twitch.tv/docs/authentication/register-app>

### 4. Authorize and configure OBS Studio

- OBS Studio is installed. Launch it when ready.
- On first launch, grant OBS the macOS Screen Recording and Microphone permissions needed for the demo.
- Connect OBS to the Twitch broadcaster account using the built-in account connection when possible. Do not expose the stream key.
- Create a temporary 1920×1080, 60 fps test scene. The Chaos Patch Browser Source will be added after the web app exists.

Official OBS site: <https://obsproject.com/>

### 5. Verify OpenAI API billing access

- Sign in to the OpenAI Platform dashboard.
- Confirm that the API project associated with the local key has billing or credits available.
- Do not create a new key unless the existing key fails a minimal API smoke test.
- Do not paste the key into chat. The application will read it from a local ignored environment file or process environment.

Official quickstart: <https://developers.openai.com/api/docs/quickstart>

## Required before the main recording

- Prepare a YouTube channel that can publish the final video publicly.
- Optionally recruit consenting viewers for a rehearsal; the broadcaster account alone is enough for the required technical proof.
- Check that the microphone, optional reaction camera, and desktop audio can be recorded clearly.
- Prepare a clean browser profile or recording layout that hides email, tokens, unrelated tabs, notifications, and personal information.

## Simplest MVP account model

Use the broadcaster's own user authorization as a Twitch chat client for the first working slice:

- `user:read:chat` to receive chat through EventSub WebSockets.
- `user:write:chat` to send round and result messages.

This avoids introducing a separate bot account during the D1 spike. A branded bot account can be considered only after the end-to-end chat loop works.

Official Twitch chat authentication guide: <https://dev.twitch.tv/docs/chat/authenticating>

## Tell Codex when these are complete

Report only completion status, never credentials:

- `Devpost joined: yes/no`
- `Twitch email + 2FA: ready/not ready`
- `Twitch developer app: created/not created`
- `OBS: installed/not installed`
- `OpenAI API billing: ready/not ready`
- `Demo Twitch channel: chosen/not chosen`

After that, Codex can scaffold the project, create `.env.example`, prepare an ignored local secret file, and guide the first OAuth/EventSub smoke test.

## Enter local credentials safely

Turn off screen sharing and recording, then run:

```bash
bash scripts/setup-secrets.sh
```

The script requires the Twitch Client ID and Client Secret, accepts an optional OpenAI API key, never prints secret values, and writes only to the Git-ignored `.env.local` file with mode `600`.
