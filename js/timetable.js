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
window.getTimetableForStop = async function(stopId) {
    console.log("停留所詳細を表示:", stopId);

    // 1. 表示エリアの確保（ポップアップ内の特定のdivや、専用のパネル）
    const container = document.getElementById('unified-timetable-container');
    if (!container) {
        console.warn("表示用コンテナが見つかりません");
        return;
    }

    container.innerHTML = `<div style="padding:10px;">時刻表を検索中...</div>`;

    try {
        let timetableData = [];

        // 2. 有効な会社ごとに stop_times.txt をスキャン
        for (const company of BUS_COMPANIES.filter(c => c.active)) {
            const res = await fetch(`${company.staticPath}stop_times.txt`);
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

            const tripIdIdx = head.indexOf('trip_id');
            const stopIdIdx = head.indexOf('stop_id');
            const arrivalIdx = head.indexOf('arrival_time');

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                // ID一致確認（高速化のため正規表現を使わず比較）
                if (cols[stopIdIdx]?.replace(/^"|"$/g, '') === stopId) {
                    timetableData.push({
                        time: cols[arrivalIdx]?.replace(/^"|"$/g, '').substring(0, 5),
                        companyName: company.name,
                        tripId: cols[tripIdIdx]?.replace(/^"|"$/g, '')
                    });
                }
            }
        }

        // 3. 時刻順にソート
        timetableData.sort((a, b) => a.time.localeCompare(b.time));

        // 4. 結果の描画
        if (timetableData.length === 0) {
            container.innerHTML = `<div style="padding:10px;">本日の運行データはありません。</div>`;
            return;
        }

        const stopName = window.stopLookup[stopId]?.name || "不明な停留所";
        let html = `<div style="padding:10px;">
                        <h3 style="margin:0 0 10px 0; border-bottom:2px solid #333;">${stopName}</h3>
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#eee; font-size:12px;">
                                    <th style="padding:5px; text-align:left;">時刻</th>
                                    <th style="padding:5px; text-align:left;">運行会社</th>
                                </tr>
                            </thead>
                            <tbody>`;
        
        timetableData.forEach(item => {
            html += `<tr style="border-bottom:1px solid #ddd; font-size:14px;">
                        <td style="padding:8px 5px;"><b>${item.time}</b></td>
                        <td style="padding:8px 5px; color:#666;">${item.companyName}</td>
                     </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (e) {
        console.error("時刻表の取得に失敗しました:", e);
        container.innerHTML = `<div style="padding:10px; color:red;">読み込みエラーが発生しました。</div>`;
    }
};
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
