import { loadConfig } from "./config.js";
import { ensureBridgeDirectories, getBridgePaths } from "./paths.js";
import { getActiveBridgePack } from "./packs/registry.js";

export async function runBridgeRuntime(importMetaUrl: string): Promise<void> {
  const paths = getBridgePaths(importMetaUrl);
  await ensureBridgeDirectories(paths);
  const config = await loadConfig(paths);
  const pack = getActiveBridgePack(config);
  const runtime = pack.createRuntime({
    paths,
    config
  });

  const shutdown = async (context: { source: string; signal?: string | null }) => {
    await runtime.stop(context);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown({
      source: "signal",
      signal: "SIGINT"
    });
  });
  process.on("SIGTERM", () => {
    void shutdown({
      source: "signal",
      signal: "SIGTERM"
    });
  });

  await runtime.run();
}
