export class MinifluxService {
    config;
    constructor(config) {
        this.config = config;
    }
    async fetchArticle(entryId) {
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
            throw new Error(`Miniflux API error ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json());
        return data;
    }
    async proxyRequest(path, method, headers, body, query) {
        const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "");
        const queryString = query ? (query.startsWith("?") ? query : `?${query}`) : "";
        const targetUrl = `${this.config.minifluxUrl}/v1/${cleanPath}${queryString}`;
        const forwardHeaders = {
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
        let requestBody;
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
        const resHeaders = {};
        res.headers.forEach((val, key) => {
            // Exclude hop-by-hop and sensitive headers
            if (key.toLowerCase() !== "content-encoding" &&
                key.toLowerCase() !== "content-length" &&
                key.toLowerCase() !== "transfer-encoding") {
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
