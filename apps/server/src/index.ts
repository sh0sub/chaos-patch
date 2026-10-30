import { createChaosPatchServer } from "./app";
import { compressProposals } from "./candidateCompressor";
import { compileCandidate } from "./compiler";
import { env } from "./env";
import { TwitchClient } from "./twitch";

const app = createChaosPatchServer({
  twitch: new TwitchClient({
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
    redirectUri: env.TWITCH_REDIRECT_URI
  }),
  compileCandidate,
  compressProposals,
  sessionSecret: env.SESSION_SECRET,
  webOrigin: env.WEB_ORIGIN
});

await app.listen({ port: env.PORT, host: "127.0.0.1" });
