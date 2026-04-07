import { NextRequest, NextResponse } from 'next/server';
import { getZendeskSources } from '@/lib/zendesk/config';
import { fetchAndSaveTickets } from '@/lib/zendesk/fetchTickets';
import { runAggregation } from '@/lib/zendesk/aggregate';

export async function POST(request: NextRequest) {
  try {
    const sources = getZendeskSources();
    if (sources.length === 0) {
      return NextResponse.json({ success: false, error: 'No Zendesk sources configured' }, { status: 400 });
    }

    const results: Record<string, number> = {};

    // 各社のチケットを取得
    for (const source of sources) {
      try {
        const count = await fetchAndSaveTickets(source);
        results[source.name] = count;
        // 当日の集計（その社）
        await runAggregation(source.key);
      } catch (err) {
        results[source.name] = -1;
        console.error(`Failed to sync ${source.name}:`, err);
      }
    }

    // 全社合算の集計
    await runAggregation('ALL');

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const sources = getZendeskSources();
  return NextResponse.json({
    success: true,
    data: {
      sources: sources.map((s) => ({ key: s.key, name: s.name })),
      configured: sources.length,
    },
  });
}
