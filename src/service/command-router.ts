import { resolveTelegramCommandHandler, type TelegramCommandHandlerKey } from "../telegram/commands.js";

export type BridgeCommandRouterHandlers = {
  [key in TelegramCommandHandlerKey]: () => Promise<void>;
};

type LegacyBridgeCommandRouterHandlers = Omit<BridgeCommandRouterHandlers, "handleSide">;

export type BridgeCommandRouterActions = (BridgeCommandRouterHandlers | LegacyBridgeCommandRouterHandlers) & {
  sendUnsupported(): Promise<void>;
};

export async function routeBridgeCommand(
  commandName: string,
  handlers: BridgeCommandRouterActions
): Promise<void> {
  const handler = resolveTelegramCommandHandler(commandName);
  if (!handler) {
    await handlers.sendUnsupported();
    return;
  }

  if (handler === "handleSide" && !("handleSide" in handlers)) {
    await handlers.sendUnsupported();
    return;
  }
  await (handlers as BridgeCommandRouterHandlers)[handler]();
}
