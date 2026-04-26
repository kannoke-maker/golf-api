import { Hono } from 'hono';
import type { GolfCoursesResponse, ErrorResponse } from '../types';
import { searchGolfCourses, RakutenApiError } from '../rakuten';
import { env } from '../env';

export const golfRoutes = new Hono();

// ---------------------------------------------------------------------------
// インメモリキャッシュ（TTL: 5分）
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GolfCoursesResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// GET /golf/courses?keyword=xxx&limit=20
// ---------------------------------------------------------------------------

golfRoutes.get('/courses', async (c) => {
  const keyword = c.req.query('keyword')?.trim() ?? '';
  const limitRaw = parseInt(c.req.query('limit') ?? '20', 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 30);

  if (!keyword) {
    return c.json<ErrorResponse>(
      { error: 'missing_keyword', message: 'keyword is required' },
      400,
    );
  }

  // キャッシュ確認
  const cacheKey = `${encodeURIComponent(keyword)}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return c.json(cached.data, 200, { 'X-Cache': 'HIT' });
  }

  // 楽天GORA 検索
  try {
    const courses = await searchGolfCourses(keyword, limit, env);
    const body: GolfCoursesResponse = { courses };

    cache.set(cacheKey, { data: body, expiresAt: Date.now() + CACHE_TTL_MS });

    return c.json(body, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    if (err instanceof RakutenApiError) {
      console.error('[golf/courses] upstream error:', err.code, err.message);
      return c.json<ErrorResponse>(
        {
          error: 'upstream_error',
          message: 'Course search is temporarily unavailable. Please try again later.',
        },
        502,
      );
    }

    console.error('[golf/courses] unexpected error:', err);
    return c.json<ErrorResponse>(
      { error: 'internal_error', message: 'An unexpected error occurred.' },
      500,
    );
  }
});
