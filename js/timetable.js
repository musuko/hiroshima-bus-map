// js/timetable.js

/**
 * 1. 【便の全停留所を取得】
 * バスをクリックした時に、そのバスがどこを通るか調べる
 */
async function getFullTimetableForTrip(tripId, companyId) {
    if (!tripId) return [];
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return [];

    try {
        // ここで stop_times.txt を読み込み、その便の停留所リストを作る
        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

        const tripIdIdx = head.indexOf('trip_id');
        const stopIdIdx = head.indexOf('stop_id');
        const arrivalIdx = head.indexOf('arrival_time');
        const seqIdx = head.indexOf('stop_sequence');

        const tripStops = [];
        for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c[tripIdIdx] === tripId) {
                const sId = c[stopIdIdx];
                tripStops.push({
                    stopId: sId,
                    stopName: window.stopLookup[sId]?.name || `停留所(${sId})`,
                    time: c[arrivalIdx].substring(0, 5),
                    sequence: parseInt(c[seqIdx])
                });
            }
        }
        return tripStops.sort((a, b) => a.sequence - b.sequence);
    } catch (e) {
        console.error("時刻表取得エラー:", e);
        return [];
    }
}

/**
 * 2. 【特定の停留所の時刻表を表示】
 * 地図上のバス停（丸いマーカー）をクリックした時に使う
 */
async function getTimetableForStop(stopId) {
    console.log("停留所詳細を表示:", stopId);
    // 必要な処理をここに記述
}

/**
 * 3. 【統合表示】
 * 複数の路線の時刻表をまとめて表示する
 */
function showUnifiedTimetable(stopId) {
    console.log("統合表示開始:", stopId);
}

// --- 【重要】ここが169行目付近の代入処理 ---
// すべての関数を定義した「後」に、window に登録します
window.getTimetableForStop = getTimetableForStop;
window.getFullTimetableForTrip = getFullTimetableForTrip;
window.showUnifiedTimetable = showUnifiedTimetable;

console.log("✅ timetable.js の読み込みが完了しました");
