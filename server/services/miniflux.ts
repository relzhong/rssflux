import type { AppConfig } from "../config.js";

export interface MinifluxArticle {
  id: number;
  user_id: number;
  feed_id: number;
  feed?: {
    id: number;
    title: string;
  };
  feed_title?: string;
  title: string;
  url: string;
  comments_url: string;
  author: string;
  content: string;
  published_at: string;
  created_at: string;
  status: string;
  starred: boolean;
  reading_time: number;
}

export class MinifluxService {
  constructor(private config: AppConfig) {}

  async fetchArticle(entryId: number): Promise<MinifluxArticle | null> {
    const url = `${this.config.minifluxUrl}/v1/entries/${entryId}`;
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": this.config.minifluxApiToken,
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Miniflux API error ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as MinifluxArticle;
    return data;
  }

  async proxyRequest(
    path: string,
    method: string,
    headers: Record<string, string | string[] | undefined>,
    body?: unknown,
    query?: string
  ): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "");
    const queryString = query ? (query.startsWith("?") ? query : `?${query}`) : "";
    const targetUrl = `${this.config.minifluxUrl}/v1/${cleanPath}${queryString}`;

    const forwardHeaders: Record<string, string> = {
      "X-Auth-Token": this.config.minifluxApiToken,
    };

    // Forward safe content headers
    if (headers["content-type"]) {
      forwardHeaders["content-type"] = Array.isArray(headers["content-type"])
        ? headers["content-type"][0]
        : headers["content-type"];
    }
    if (headers["accept"]) {
      forwardHeaders["accept"] = Array.isArray(headers["accept"])
        ? headers["accept"][0]
        : headers["accept"];
    }
    if (headers["if-none-match"]) {
      forwardHeaders["if-none-match"] = Array.isArray(headers["if-none-match"])
        ? headers["if-none-match"][0]
        : headers["if-none-match"];
    }
    if (headers["if-modified-since"]) {
      forwardHeaders["if-modified-since"] = Array.isArray(headers["if-modified-since"])
        ? headers["if-modified-since"][0]
        : headers["if-modified-since"];
    }

    let requestBody: string | undefined;
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      requestBody = typeof body === "string" ? body : JSON.stringify(body);
      if (!forwardHeaders["content-type"]) {
        forwardHeaders["content-type"] = "application/json";
      }
    }

    const res = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: requestBody,
    });

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      // Exclude hop-by-hop and sensitive headers
      if (
        key.toLowerCase() !== "content-encoding" &&
        key.toLowerCase() !== "content-length" &&
        key.toLowerCase() !== "transfer-encoding"
      ) {
        resHeaders[key] = val;
      }
    });

    const arrayBuf = await res.arrayBuffer();
    const resBody = Buffer.from(arrayBuf);

    return {
      status: res.status,
      headers: resHeaders,
      body: resBody,
    };
  }
}
