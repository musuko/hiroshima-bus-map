// js/gtfs_loader.js 内の calendar.txt 処理部分

// --- ここから調査用コード ---
const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
const todayStr = y + m + d; // "20240522" のような形式
const dayOfWeek = now.getDay(); // 0:日, 1:月...
const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const todayWeekKey = weekDays[dayOfWeek];

console.log(`🔍 日付判定デバッグ: 今日は ${todayStr} (${todayWeekKey}) です`);

// ...（中略：ファイル読み込み処理）

// calendar.txt のループ内
for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
    if (c.length < 10) continue;

    const serviceId = c[idxServiceId];
    const startDate = c[idxStartDate];
    const endDate = c[idxEndDate];
    const isRunningToday = c[header.indexOf(todayWeekKey)] === "1";

    // 【重要】コンソールで範囲を確認
    if (i === 1) {
        console.log(`📅 GTFS有効期間サンプル: ${startDate} ～ ${endDate}`);
    }

    // 判定ロジック（一時的に日付チェックを無視して「曜日」だけで判定してみる）
    if (isRunningToday) {
        window.activeServiceIds.add(serviceId);
    }
}

// calendar_dates.txt (臨時運行) のループ内
// ここも、日付が今日(todayStr)と一致するかチェックしている箇所にログを出す
if (c[idxDate] === todayStr) {
    const exceptionType = c[idxExceptionType];
    if (exceptionType === "1") {
        window.activeServiceIds.add(serviceId);
        // console.log("📅 臨時運行追加: " + serviceId); // 消したい場合はここをコメントアウト
    } else {
        window.activeServiceIds.delete(serviceId);
    }
}
// --- 調査用コードここまで ---
