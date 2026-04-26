// ---------------------------------------------------------------------------
// 環境変数（Workers secrets）
// ---------------------------------------------------------------------------

export interface Env {
  /** 楽天ウェブサービス アプリID（認証必須） */
  RAKUTEN_APPLICATION_ID: string;
  /** 楽天ウェブサービス アクセスキー（認証必須。affiliateId とは別物） */
  RAKUTEN_ACCESS_KEY: string;
  /**
   * 楽天 API へのリクエストに付与する Referer URL（省略時は DEFAULT_REFERRER を使用）。
   * 楽天アプリ登録画面の「APIリクエストを許可するWebサイト」に登録したURLと一致させること。
   * Workers へデプロイ後は本番ドメインを wrangler secret put で登録する。
   */
  RAKUTEN_REFERRER_URL?: string;
}

// ---------------------------------------------------------------------------
// iOS 向けレスポンス型
// ---------------------------------------------------------------------------

/** コース1件 — GolfCourseInfo (iOS) と 1:1 対応 */
export interface GolfCourse {
  id: number;
  name: string;
  address: string;
  holeCount: number;
  courseCount: number;
}

export interface GolfCoursesResponse {
  courses: GolfCourse[];
}

/** コース詳細 — GolfCourseDetail (iOS) と 1:1 対応 */
export interface GolfCourseDetail {
  id: number;
  name: string;
  address: string;
  holeCount: number;
  courseCount: number;
  caption: string;
  latitude: number;
  longitude: number;
  evaluation: number;
  nearestStation: string;
  telephoneNo: string;
}

export interface GolfCourseDetailResponse {
  course: GolfCourseDetail;
}

/** 統一エラーレスポンス */
export interface ErrorResponse {
  error: string;
  message: string;
}
