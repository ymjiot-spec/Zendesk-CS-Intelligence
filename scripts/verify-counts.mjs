/**
 * チケット件数集計の検証スクリプト
 * DB直接クエリで各期間の件数を取得し、修正後のロジックと照合する。
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/zendesk_cs_dashboard?schema=public',
});

// 現在のJST日付
const JST_OFFSET = 9 * 60 * 60 * 1000;
function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET);
  return jst.toISOString().split('T')[0];
}
function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  d.setDate(d.getDate() + days);
  const jst = new Date(d.getTime() + JST_OFFSET);
  return jst.toISOString().split('T')[0];
}
function thisWeekMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  const dow = d.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  return shiftDays(dateStr, -diff);
}

async function query(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function countTickets(startJST, endJST, extraCondition = '') {
  // startJST, endJST は YYYY-MM-DD（JST日付文字列）
  const sql = `
    SELECT COUNT(*) as cnt
    FROM tickets
    WHERE is_excluded = false
      AND created_at >= ($1 || 'T00:00:00+09:00')::timestamptz
      AND created_at <  ($2 || 'T00:00:00+09:00')::timestamptz
      ${extraCondition}
  `;
  const rows = await query(sql, [startJST, shiftDays(endJST, 1)]);
  return parseInt(rows[0].cnt, 10);
}

async function main() {
  const today = todayJST();
  const yesterday = shiftDays(today, -1);
  console.log('=== チケット件数集計 検証 ===');
  console.log(`検証日時: ${new Date().toISOString()} (JST: ${today})`);
  console.log('');

  // --- 全件数（除外前/除外後）---
  const totalAll = await query(`SELECT COUNT(*) as cnt FROM tickets`);
  const totalExcluded = await query(`SELECT COUNT(*) as cnt FROM tickets WHERE is_excluded = true`);
  const totalIncluded = await query(`SELECT COUNT(*) as cnt FROM tickets WHERE is_excluded = false`);
  console.log(`■ DB全体: 全件=${totalAll[0].cnt}, 除外=${totalExcluded[0].cnt}, 集計対象=${totalIncluded[0].cnt}`);

  // Z始まりステータスの除外確認
  const zStatus = await query(`
    SELECT ticket_status, is_excluded, COUNT(*) as cnt
    FROM tickets
    WHERE ticket_status ILIKE 'Z%'
    GROUP BY ticket_status, is_excluded
    ORDER BY ticket_status
  `);
  console.log('\n■ Z始まりステータスの除外状況:');
  if (zStatus.length === 0) {
    console.log('  (Z始まりステータスなし)');
  } else {
    for (const r of zStatus) {
      console.log(`  status="${r.ticket_status}" is_excluded=${r.is_excluded} count=${r.cnt}`);
    }
    const zNotExcluded = zStatus.filter(r => !r.is_excluded);
    if (zNotExcluded.length > 0) {
      console.log('  ⚠️  Z始まりステータスで除外されていないものがあります！');
    } else {
      console.log('  ✅  Z始まりステータスはすべて除外済み');
    }
  }

  // --- 期間別件数 ---
  console.log('\n■ 期間別件数（DB直接クエリ）:');

  const todayCount = await countTickets(today, today);
  console.log(`  今日 (${today}): ${todayCount} 件`);

  const yesterdayCount = await countTickets(yesterday, yesterday);
  console.log(`  昨日 (${yesterday}): ${yesterdayCount} 件`);

  // 直近7日
  const sevenAgo = shiftDays(today, -6);
  const last7Count = await countTickets(sevenAgo, today);
  console.log(`  直近7日 (${sevenAgo}〜${today}): ${last7Count} 件`);

  // 今週（月曜〜今日）
  const thisMonday = thisWeekMonday(today);
  const thisWeekCount = await countTickets(thisMonday, today);
  console.log(`  今週 (${thisMonday}〜${today}): ${thisWeekCount} 件`);

  // 先週（前週月〜日）
  const lastMonday = shiftDays(thisMonday, -7);
  const lastSunday = shiftDays(thisMonday, -1);
  const lastWeekCount = await countTickets(lastMonday, lastSunday);
  console.log(`  先週 (${lastMonday}〜${lastSunday}): ${lastWeekCount} 件`);

  // 今月
  const thisFirst = today.slice(0, 8) + '01';
  const thisMonthCount = await countTickets(thisFirst, today);
  console.log(`  今月 (${thisFirst}〜${today}): ${thisMonthCount} 件`);

  // 先月
  const year = parseInt(today.slice(0, 4), 10);
  const month = parseInt(today.slice(5, 7), 10);
  let prevYear = year, prevMonth = month - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear--; }
  const lastMonthFirst = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month - 1, 0).getDate();
  const lastMonthLast = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const lastMonthCount = await countTickets(lastMonthFirst, lastMonthLast);
  console.log(`  先月 (${lastMonthFirst}〜${lastMonthLast}): ${lastMonthCount} 件`);

  // 前日比
  const dayDiff = todayCount - yesterdayCount;
  const dayRate = yesterdayCount > 0 ? Math.round((dayDiff / yesterdayCount) * 1000) / 10 : 0;
  console.log(`\n■ 前日比: ${dayDiff >= 0 ? '+' : ''}${dayDiff}件 (${dayRate >= 0 ? '+' : ''}${dayRate}%)`);

  // 週比較（今週同日数 vs 先週同日数）
  const daysIntoWeek = Math.round((new Date(today + 'T00:00:00+09:00').getTime() - new Date(thisMonday + 'T00:00:00+09:00').getTime()) / 86400000) + 1;
  const lastWeekSameDay = shiftDays(lastMonday, daysIntoWeek - 1);
  const lastWeekSameCount = await countTickets(lastMonday, lastWeekSameDay);
  const weekDiff = thisWeekCount - lastWeekSameCount;
  const weekRate = lastWeekSameCount > 0 ? Math.round((weekDiff / lastWeekSameCount) * 1000) / 10 : 0;
  console.log(`  週比較 (今週${daysIntoWeek}日間 vs 先週同期間): ${weekDiff >= 0 ? '+' : ''}${weekDiff}件 (${weekRate >= 0 ? '+' : ''}${weekRate}%)`);

  // 月比較（今月同日数 vs 先月同日数）
  const daysIntoMonth = Math.round((new Date(today + 'T00:00:00+09:00').getTime() - new Date(thisFirst + 'T00:00:00+09:00').getTime()) / 86400000) + 1;
  let lastMonthSameDay = shiftDays(lastMonthFirst, daysIntoMonth - 1);
  if (lastMonthSameDay > lastMonthLast) lastMonthSameDay = lastMonthLast;
  const lastMonthSameCount = await countTickets(lastMonthFirst, lastMonthSameDay);
  const monthDiff = thisMonthCount - lastMonthSameCount;
  const monthRate = lastMonthSameCount > 0 ? Math.round((monthDiff / lastMonthSameCount) * 1000) / 10 : 0;
  console.log(`  月比較 (今月${daysIntoMonth}日間 vs 先月同期間): ${monthDiff >= 0 ? '+' : ''}${monthDiff}件 (${monthRate >= 0 ? '+' : ''}${monthRate}%)`);

  // --- カテゴリ別 ---
  console.log('\n■ 問い合わせ項目別件数（今日）:');
  const catRows = await query(`
    SELECT inquiry_category, COUNT(*) as cnt
    FROM tickets
    WHERE is_excluded = false
      AND created_at >= ($1 || 'T00:00:00+09:00')::timestamptz
      AND created_at <  ($2 || 'T00:00:00+09:00')::timestamptz
    GROUP BY inquiry_category
    ORDER BY cnt DESC
  `, [today, shiftDays(today, 1)]);

  const catTotal = catRows.reduce((s, r) => s + parseInt(r.cnt, 10), 0);
  let percentSum = 0;
  for (const r of catRows) {
    const cnt = parseInt(r.cnt, 10);
    const pct = catTotal > 0 ? Math.round((cnt / catTotal) * 1000) / 10 : 0;
    percentSum += pct;
    console.log(`  ${r.inquiry_category || '(未設定)'}: ${cnt}件 (${pct}%)`);
  }
  console.log(`  ---`);
  console.log(`  合計: ${catTotal}件 (割合合計: ${percentSum.toFixed(1)}%)`);
  console.log(`  ✅ カテゴリ合計 ${catTotal} = 今日の件数 ${todayCount}: ${catTotal === todayCount ? '一致' : '⚠️ 不一致!'}`);

  // 割合合計チェック
  if (Math.abs(percentSum - 100) < 1) {
    console.log(`  ✅ 割合合計 ${percentSum.toFixed(1)}% ≈ 100%`);
  } else if (catTotal === 0) {
    console.log(`  ℹ️ データなし（割合は0%）`);
  } else {
    console.log(`  ⚠️ 割合合計 ${percentSum.toFixed(1)}% が100%から乖離しています`);
  }

  console.log('\n=== 検証完了 ===');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
