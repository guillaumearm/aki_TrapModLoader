import { DependencyContainer } from "tsyringe";

import type { IMod } from "@spt-aki/models/external/mod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { getModDisplayName, noop } from "./utils";

// TODO config
const DEBUG = true;

const getWelcomeMessageBox = (message: string): string => {
  const character = "=";
  const margin = 5;
  const decoration = Array.from(Array(message.length + margin).keys())
    .map(() => character)
    .join("");

  return `====${decoration}
=== ${message} ====
====${decoration}`;
};

class Mod implements IMod {
  private logger: ILogger;
  private debug: (data: string) => void;

  public load(container: DependencyContainer): void {
    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.debug = DEBUG
      ? (data: string) => this.logger.debug(`TrapModLoader: ${data}`, true)
      : noop;

    if (DEBUG) {
      this.debug("debug mode enabled");
    }

    this.logger.info(
      getWelcomeMessageBox(`Loading ${getModDisplayName(true)}`)
    );
  }

  public delayedLoad(container: DependencyContainer): void {
    void container;
    this.logger.success(
      getWelcomeMessageBox(`Successfully loaded ${getModDisplayName(true)}`)
    );
  }
}

module.exports = { mod: new Mod() };
