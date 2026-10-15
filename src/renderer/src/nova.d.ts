import type { NovaApi } from "../../preload/index";

declare global {
  interface Window {
    nova: NovaApi;
  }
}

export {};
