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
    console.log("1. 検索開始 stopId:", stopId);
    
    const container = document.getElementById('unified-timetable-container');
    if (!container) {
        console.error("エラー: 表示用コンテナ 'unified-timetable-container' がHTMLに存在しません。");
        return;
    }
    container.innerHTML = "時刻表を読み込み中...";

    try {
        // --- 手順2: バス停名称の取得 ---
        // window.stopLookup は gtfs_loader.js で作成済みのはず
        const stopName = window.stopLookup[stopId]?.name || `停留所ID: ${stopId}`;
        console.log("2. バス停名称確定:", stopName);

        let timetableData = [];

        // --- 手順3: stop_times.txt を読み込んで時刻と行先を抽出 ---
        for (const company of BUS_COMPANIES.filter(c => c.active)) {
            console.log(`3. ${company.name} のファイルを読み込みます...`);
            
            const res = await fetch(`${company.staticPath}stop_times.txt`);
            if (!res.ok) {
                console.warn(`${company.name} の stop_times.txt が見つかりません`);
                continue;
            }
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            
            // ヘッダー解析
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const stopIdIdx = head.indexOf('stop_id');
            const arrivalIdx = head.indexOf('arrival_time');
            const headsignIdx = head.indexOf('stop_headsign'); // 行先

            console.log(`4. ${company.name} の解析開始（全 ${lines.length} 行）`);

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                
                if (cols[stopIdIdx] === stopId) {
                    timetableData.push({
                        time: cols[arrivalIdx] ? cols[arrivalIdx].substring(0, 5) : "--:--",
                        headsign: cols[headsignIdx] || "運行中",
                        company: company.name
                    });
                }
            }
        }

        console.log("5. データ抽出完了。件数:", timetableData.length);

        // --- 手順4: ソートと表示 ---
        timetableData.sort((a, b) => a.time.localeCompare(b.time));

        if (timetableData.length === 0) {
            container.innerHTML = `<h4>${stopName}</h4><p>運行データがありません。</p>`;
            return;
        }

        let html = `<h3>${stopName}</h3>`;
        html += `<table style="width:100%; border-collapse:collapse; font-family:sans-serif;">`;
        html += `<tr style="background:#eee;"><th>時刻</th><th>行先</th></tr>`;
        
        timetableData.forEach(row => {
            html += `<tr style="border-bottom:1px solid #ddd;">
                        <td style="padding:8px; font-weight:bold;">${row.time}</td>
                        <td style="padding:8px;">${row.headsign} <small style="color:#999;">(${row.company})</small></td>
                     </tr>`;
        });
        html += `</table>`;

        container.innerHTML = html;
        console.log("6. 表示完了");

    } catch (e) {
        console.error("致命的エラー:", e);
        container.innerHTML = "時刻表の取得中にエラーが発生しました。";
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
