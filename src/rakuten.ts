import * as https from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { Env, GolfCourse, GolfCourseDetail } from './types';

// ---------------------------------------------------------------------------
// 楽天GORA エンドポイント
// ---------------------------------------------------------------------------

const RAKUTEN_SEARCH_ENDPOINT =
  'https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623';

const RAKUTEN_DETAIL_ENDPOINT =
  'https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseDetail/20170623';

const DEFAULT_REFERRER = 'https://golf-api.example.onrender.com';

// ---------------------------------------------------------------------------
// エラー
// ---------------------------------------------------------------------------

export class RakutenApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RakutenApiError';
  }
}

// ---------------------------------------------------------------------------
// 楽天レスポンス型（formatVersion=2 / 内部使用のみ — iOS に露出させない）
// ---------------------------------------------------------------------------

interface RakutenSearchResponse {
  count: number;
  Items: RakutenCourseItem[];
}

interface RakutenCourseItem {
  golfCourseId: number;
  golfCourseName: string;
  address?: string;
  holeCount?: number;
  courseCount?: number;
}

interface RakutenErrorResponse {
  error: string;
  error_description?: string;
}

// ---------------------------------------------------------------------------
// https.get() ラッパー（fetch() は Referer を forbidden header として除去するため使わない）
// ---------------------------------------------------------------------------

/** 非2xx レスポンス body から楽天エラーコードを取り出す。取れなければ 'http_error' を返す。 */
function extractRakutenErrorCode(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error) return parsed.error;
  } catch { /* ignore */ }
  return 'http_error';
}

function httpsGet(urlStr: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, { headers }, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
      );
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// 公開API
// ---------------------------------------------------------------------------

/**
 * 楽天GORA でコース検索し、iOS 向け GolfCourse[] に整形して返す。
 * 楽天 API 障害時は RakutenApiError を throw する。
 */
export async function searchGolfCourses(
  keyword: string,
  limit: number,
  env: Env,
): Promise<GolfCourse[]> {
  const params = new URLSearchParams({
    applicationId: env.RAKUTEN_APPLICATION_ID,
    accessKey:     env.RAKUTEN_ACCESS_KEY,
    keyword,
    hits:          String(limit),
    format:        'json',
    formatVersion: '2',
  });

  const url = `${RAKUTEN_SEARCH_ENDPOINT}?${params.toString()}`;
  const referrer = env.RAKUTEN_REFERRER_URL ?? DEFAULT_REFERRER;
  const headers = {
    Referer:      referrer,
    Origin:       referrer.replace(/\/$/, ''),
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  let status: number;
  let body: string;
  try {
    ({ status, body } = await httpsGet(url, headers));
  } catch (err) {
    throw new RakutenApiError('network_error', `request failed: ${String(err)}`);
  }

  if (status < 200 || status >= 300) {
    const errorCode = extractRakutenErrorCode(body);
    console.error('[rakuten] HTTP', status, '| code:', errorCode, '| body:', body);
    throw new RakutenApiError(errorCode, `Rakuten returned HTTP ${status}`);
  }

  const json = JSON.parse(body) as RakutenSearchResponse | RakutenErrorResponse;

  if ('error' in json && typeof json.error === 'string' && json.error !== '') {
    const errJson = json as RakutenErrorResponse;
    console.error('[rakuten] API error:', errJson.error, errJson.error_description ?? '');
    throw new RakutenApiError(errJson.error, errJson.error_description ?? errJson.error);
  }

  const data = json as RakutenSearchResponse;
  return (data.Items ?? []).map((item) => ({
    id:          item.golfCourseId,
    name:        item.golfCourseName,
    address:     item.address ?? '',
    holeCount:   item.holeCount ?? 18,
    courseCount: item.courseCount ?? 1,
  }));
}

// ---------------------------------------------------------------------------
// 詳細API レスポンス型（内部使用のみ）
// ---------------------------------------------------------------------------

interface RakutenDetailResponse {
  Item: RakutenDetailItem;
}

interface RakutenDetailItem {
  golfCourseId:      number;
  golfCourseName:    string;
  address?:          string;
  holeCount?:        number;
  courseCount?:      number;
  golfCourseCaption?: string;
  latitude?:         number | string;
  longitude?:        number | string;
  evaluation?:       number | string;
  nearestStation?:   string;
  telephoneNo?:      string;
}

// ---------------------------------------------------------------------------
// 詳細取得
// ---------------------------------------------------------------------------

/**
 * 楽天GORA でコース詳細を取得し、iOS 向け GolfCourseDetail に整形して返す。
 */
export async function getGolfCourseDetail(
  golfCourseId: number,
  env: Env,
): Promise<GolfCourseDetail> {
  const params = new URLSearchParams({
    applicationId: env.RAKUTEN_APPLICATION_ID,
    accessKey:     env.RAKUTEN_ACCESS_KEY,
    golfCourseId:  String(golfCourseId),
    format:        'json',
    formatVersion: '2',
  });

  const url = `${RAKUTEN_DETAIL_ENDPOINT}?${params.toString()}`;
  const referrer = env.RAKUTEN_REFERRER_URL ?? DEFAULT_REFERRER;
  const headers = {
    Referer:      referrer,
    Origin:       referrer.replace(/\/$/, ''),
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  let status: number;
  let body: string;
  try {
    ({ status, body } = await httpsGet(url, headers));
  } catch (err) {
    throw new RakutenApiError('network_error', `request failed: ${String(err)}`);
  }

  if (status < 200 || status >= 300) {
    const errorCode = extractRakutenErrorCode(body);
    console.error('[rakuten/detail] HTTP', status, '| code:', errorCode, '| body:', body);
    throw new RakutenApiError(errorCode, `Rakuten returned HTTP ${status}`);
  }

  const json = JSON.parse(body) as RakutenDetailResponse | RakutenErrorResponse;

  if ('error' in json && typeof json.error === 'string' && json.error !== '') {
    const errJson = json as RakutenErrorResponse;
    console.error('[rakuten/detail] API error:', errJson.error, errJson.error_description ?? '');
    throw new RakutenApiError(errJson.error, errJson.error_description ?? errJson.error);
  }

  const item = (json as RakutenDetailResponse).Item;
  return {
    id:             item.golfCourseId,
    name:           item.golfCourseName,
    address:        item.address        ?? '',
    holeCount:      item.holeCount      ?? 18,
    courseCount:    item.courseCount    ?? 1,
    caption:        item.golfCourseCaption ?? '',
    latitude:       Number(item.latitude  ?? 0),
    longitude:      Number(item.longitude ?? 0),
    evaluation:     Number(item.evaluation ?? 0),
    nearestStation: item.nearestStation ?? '',
    telephoneNo:    item.telephoneNo    ?? '',
  };
}
