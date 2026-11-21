export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** Fetch JSON with a timeout. Network failures become ApiError(0, "network"). */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; timeout?: number } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout ?? 8000);
  try {
    const init: RequestInit = { method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"), signal: ctl.signal, credentials: "same-origin" };
    if (opts.form) init.body = opts.form;
    else if (opts.body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(opts.body);
    }
    let res: Response;
    try {
      res = await fetch(path, init);
    } catch {
      throw new ApiError(0, "network");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "server_error");
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** What the lecturer sees: counts already filtered by the server ("a few" under 3). */
export type Shown = "none" | "few" | number;

export interface SlideT {
  n: number;
  title: string;
  titleUr: string;
  summary: string;
  summaryUr: string;
}
export interface LecturerSlide extends SlideT {
  display: Shown;
}
export interface LecturerSession {
  id: number;
  code: string;
  title: string;
  course: string;
  language: "both" | "en";
  status: "draft" | "live" | "ended";
  current: number;
  joined: number;
  startedAt: string | null;
  endedAt: string | null;
  totalPins: Shown;
  hottest: number | null;
  slides: LecturerSlide[];
  comments: { slide: number; text: string }[];
  transcript: { at: string; text: string }[];
}
export interface SessionListItem {
  id: number;
  code: string;
  title: string;
  course: string;
  status: "draft" | "live" | "ended";
  joined: number;
  pins: Shown;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}
export interface PublicSession {
  code: string;
  title: string;
  language: "both" | "en";
  status: "draft" | "live" | "ended";
  current: number;
  slides: SlideT[];
}
export interface Lecturer {
  id: number;
  name: string;
  email: string;
}
