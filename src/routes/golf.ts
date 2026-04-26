import { Hono } from 'hono';
import type { GolfCoursesResponse, GolfCourseDetailResponse, ErrorResponse } from '../types';
import { searchGolfCourses, getGolfCourseDetail, RakutenApiError } from '../rakuten';
import { env } from '../env';

export const golfRoutes = new Hono();

// ---------------------------------------------------------------------------
// インメモリキャッシュ（TTL: 5分）
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown;
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
    return c.json(cached.data as GolfCoursesResponse, 200, { 'X-Cache': 'HIT' });
  }

  // 楽天GORA 検索
  try {
    const courses = await searchGolfCourses(keyword, limit, env);
    const body: GolfCoursesResponse = { courses };

    cache.set(cacheKey, { data: body as unknown, expiresAt: Date.now() + CACHE_TTL_MS });

    return c.json(body, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    if (err instanceof RakutenApiError) {
      if (err.code === 'not_found') {
        return c.json<GolfCoursesResponse>({ courses: [] }, 200);
      }
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

// ---------------------------------------------------------------------------
// GET /golf/courses/:id
// ---------------------------------------------------------------------------

golfRoutes.get('/courses/:id', async (c) => {
  const idRaw = parseInt(c.req.param('id'), 10);
  if (isNaN(idRaw) || idRaw <= 0) {
    return c.json<ErrorResponse>(
      { error: 'invalid_id', message: 'id must be a positive integer' },
      400,
    );
  }

  // キャッシュ確認
  const cacheKey = `detail:${idRaw}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return c.json(cached.data as GolfCourseDetailResponse, 200, { 'X-Cache': 'HIT' });
  }

  try {
    const course = await getGolfCourseDetail(idRaw, env);
    const body: GolfCourseDetailResponse = { course };

    cache.set(cacheKey, { data: body as unknown, expiresAt: Date.now() + CACHE_TTL_MS });

    return c.json(body, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    if (err instanceof RakutenApiError) {
      if (err.code === 'not_found') {
        return c.json<ErrorResponse>({ error: 'not_found', message: 'Course not found' }, 404);
      }
      console.error('[golf/courses/:id] upstream error:', err.code, err.message);
      return c.json<ErrorResponse>(
        {
          error: 'upstream_error',
          message: 'Course detail is temporarily unavailable. Please try again later.',
        },
        502,
      );
    }

    console.error('[golf/courses/:id] unexpected error:', err);
    return c.json<ErrorResponse>(
      { error: 'internal_error', message: 'An unexpected error occurred.' },
      500,
    );
  }
});
