import { preconnect } from "react-dom";

const PRELOAD_TIMEOUT_MS = 10_000;
const CANCELLED_PRELOAD_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

interface ImageRequest {
  loaded: Promise<void>;
  cancel: () => void;
}

/** Owns only this reader's requests; clear also allows React's effect replay. */
export function createImagePreloader() {
  const requests = new Map<string, ImageRequest>();
  const connectedOrigins = new Set<string>();

  function connectOrigin(imageUrl: string) {
    try {
      const url = new URL(imageUrl);
      if ((url.protocol === "http:" || url.protocol === "https:") && !connectedOrigins.has(url.origin)) {
        preconnect(url.origin);
        connectedOrigins.add(url.origin);
      }
    } catch {
      // Relative and data URLs do not need a separate origin connection.
    }
  }

  function load(imageUrl: string): Promise<void> {
    const existing = requests.get(imageUrl);
    if (existing) return existing.loaded;
    connectOrigin(imageUrl);

    const image = new Image();
    image.decoding = "async";
    let cancel = () => {};
    const loaded = new Promise<void>(resolve => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        image.onload = null;
        image.onerror = null;
        resolve();
      };
      const timeoutId = window.setTimeout(() => {
        requests.delete(imageUrl);
        cancel();
      }, PRELOAD_TIMEOUT_MS);
      cancel = () => {
        const pending = !settled;
        settle();
        // Empty src retains Chromium's broken-image viewport listener. Replace
        // only pending requests with a valid pixel to abort without that fallback.
        if (pending) image.src = CANCELLED_PRELOAD_IMAGE;
      };
      image.onload = () => { void image.decode().catch(() => undefined).finally(settle); };
      image.onerror = () => {
        requests.delete(imageUrl);
        cancel();
      };
    });
    requests.set(imageUrl, { loaded, cancel });
    image.src = imageUrl;
    return loaded;
  }

  return {
    preload(imageUrls: Array<string | null | undefined>): Promise<void> {
      return Promise.all(imageUrls.filter((url): url is string => !!url).map(load)).then(() => undefined);
    },
    clear() {
      requests.forEach(request => request.cancel());
      requests.clear();
      connectedOrigins.clear();
    },
  };
}
