export function requestLiaLaunch(options?: { fetchImpl?: typeof fetch }): Promise<string>;
export function navigateToLiaLaunch(options?: {
  requestLaunch?: () => Promise<string>;
  navigate?: (url: string) => void;
}): Promise<void>;
