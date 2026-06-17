/**
 * Thin REST client for the Tana Local API (http://localhost:8262).
 *
 * The Tana desktop app exposes the SAME operations over two façades: an `/mcp`
 * endpoint for AI clients (Claude Code, Cursor) and a plain REST API. A Zotero
 * plugin wants REST, so this wraps it directly — no MCP protocol ceremony.
 *
 * Endpoint shapes were taken from the server's own /openapi.json ("Tana Local
 * API" v1.0.0). The app must be running with the Local API enabled and the target
 * workspace loaded; otherwise requests fail (use `health()` to preflight).
 *
 * `fetch` is injected so the plugin can pass the Zotero window's fetch, mirroring
 * how notero injects window.fetch into the Notion client.
 */

export interface TanaClientOptions {
  /** Personal API token (per workspace) from Tana → Settings → API Tokens. */
  token: string;
  /** Override the base URL. Default: http://localhost:8262 */
  baseUrl?: string;
  /** fetch implementation (default: global fetch). */
  fetch?: typeof globalThis.fetch;
}

export interface CreatedNode {
  id: string;
  name: string;
}

export interface ImportResult {
  parentNodeId: string;
  targetNodeId: string;
  /** The tagged node has the visible name; field-value nodes come back empty-named. */
  createdNodes: CreatedNode[];
  message: string;
}

export interface SearchNode {
  id: string;
  name: string;
  breadcrumb: string[];
  tags: { id: string; name: string }[];
  tagIds: string[];
  workspaceId: string;
  docType: string;
  description?: string;
  created: string;
  inTrash: boolean;
}

export interface ReadResult {
  markdown: string;
  name?: string;
  description?: unknown;
}

export type FieldMode = 'replace' | 'append';

/** Thrown for non-2xx responses, carrying the HTTP status and raw body. */
export class TanaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = 'TanaApiError';
  }
}

const DEFAULT_BASE_URL = 'http://localhost:8262';

export class TanaClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchFn: typeof globalThis.fetch;

  public constructor({ token, baseUrl, fetch: fetchFn }: TanaClientOptions) {
    this.token = token;
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /** True if the server is up and the node space is ready. No auth required. */
  public async health(): Promise<boolean> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/health`);
      if (!res.ok) return false;
      const json = (await res.json()) as { status?: string; nodeSpaceReady?: boolean };
      return json.status === 'ok' && json.nodeSpaceReady !== false;
    } catch {
      return false;
    }
  }

  /** Create nodes from Tana Paste under a parent. Returns the created node IDs. */
  public import(parentNodeId: string, content: string): Promise<ImportResult> {
    return this.request('POST', `/nodes/${enc(parentNodeId)}/import`, { content });
  }

  /** Set (replace by default) a plain/url/date/number/text field's value. The upsert primitive. */
  public async setFieldContent(
    nodeId: string,
    attributeId: string,
    content: string,
    mode: FieldMode = 'replace',
  ): Promise<void> {
    await this.request(
      'POST',
      `/nodes/${enc(nodeId)}/fields/${enc(attributeId)}/content`,
      { content, mode },
    );
  }

  /** Set an options field to a predefined option (e.g. Item Type). */
  public async setFieldOption(
    nodeId: string,
    attributeId: string,
    optionId: string,
    mode: FieldMode = 'replace',
  ): Promise<void> {
    await this.request(
      'POST',
      `/nodes/${enc(nodeId)}/fields/${enc(attributeId)}/option`,
      { optionId, mode },
    );
  }

  /** Add or remove supertags on a node. */
  public async setTags(
    nodeId: string,
    tagIds: string[],
    action: 'add' | 'remove' = 'add',
  ): Promise<void> {
    await this.request('POST', `/nodes/${enc(nodeId)}/tags`, { action, tagIds });
  }

  /** Move a node to the workspace trash. */
  public async trash(nodeId: string): Promise<void> {
    await this.request('POST', `/nodes/${enc(nodeId)}/trash`, {});
  }

  /** Read a node (and children to maxDepth) as markdown. */
  public readNode(nodeId: string, maxDepth = 1): Promise<ReadResult> {
    return this.request('GET', `/nodes/${enc(nodeId)}`, undefined, { maxDepth });
  }

  /** Structured search (same query shape as the MCP search_nodes tool). */
  public search(
    query: object,
    opts: { workspaceIds?: string[]; limit?: number } = {},
  ): Promise<SearchNode[]> {
    return this.request('GET', '/nodes/search', undefined, {
      query: JSON.stringify(query),
      ...(opts.workspaceIds ? { workspaceIds: opts.workspaceIds.join(',') } : {}),
      ...(opts.limit ? { limit: opts.limit } : {}),
    });
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    query?: Record<string, string | number>,
  ): Promise<any> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ).toString();
      if (qs) url += `?${qs}`;
    }

    const res = await this.fetchFn(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new TanaApiError(
        res.status,
        text,
        `Tana Local API ${method} ${path} failed: ${res.status} ${res.statusText}`,
      );
    }

    if (res.status === 204) return undefined;
    return res.json();
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
