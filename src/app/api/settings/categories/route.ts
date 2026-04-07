import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: 各社のカテゴリ一覧と集計対象フラグを取得
export async function GET(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams.get('source');

    if (!source) {
      return NextResponse.json({ success: false, error: 'source is required' }, { status: 400 });
    }

    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      SELECT 
        cfs.source_key, 
        cfs.inquiry_category, 
        cfs.is_included,
        COALESCE((SELECT COUNT(*)::int FROM tickets t WHERE t.source_key = cfs.source_key AND t.inquiry_category = cfs.inquiry_category), 0) as ticket_count
      FROM category_filter_settings cfs
      WHERE cfs.source_key = $1
      ORDER BY ticket_count DESC
    `, source);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Category settings GET error:', error);
    return NextResponse.json({ success: false, data: [], error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}

// PUT: カテゴリの集計対象フラグを更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_key, inquiry_category, is_included } = body;

    if (!source_key || !inquiry_category || typeof is_included !== 'boolean') {
      return NextResponse.json({ success: false, error: 'source_key, inquiry_category, is_included required' }, { status: 400 });
    }

    // category_filter_settingsを更新
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO category_filter_settings (source_key, inquiry_category, is_included, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (source_key, inquiry_category) 
      DO UPDATE SET is_included = $3, updated_at = NOW()
    `, source_key, inquiry_category, is_included);

    // ticketsテーブルのis_excludedも連動更新
    await (prisma as any).$executeRawUnsafe(`
      UPDATE tickets SET is_excluded = $1
      WHERE source_key = $2 AND inquiry_category = $3
    `, !is_included, source_key, inquiry_category);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category settings PUT error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'error' }, { status: 500 });
  }
}
