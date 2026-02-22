// js/timetable.js

/**
 * 1. 便の全停留所を取得・表示する関数 (バス車両アイコンをクリックした時に使用)
 */
async function getFullTimetableForTrip(tripId, companyId) {
    if (!tripId) return [];
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return [];

    try {
        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

        const tIdx = head.indexOf('trip_id');
        const sIdx = head.indexOf('stop_id');
        const aIdx = head.indexOf('arrival_time');
        const sqIdx = head.indexOf('stop_sequence');

        const tripStops = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (cols[tIdx] === tripId) {
                const sId = cols[sIdx];
                tripStops.push({
                    stopId: sId,
                    stopName: window.stopLookup[sId]?.name || `停留所(${sId})`,
                    time: cols[aIdx] ? cols[aIdx].substring(0, 5) : "--:--",
                    sequence: parseInt(cols[sqIdx])
                });
            }
        }
        return tripStops.sort((a, b) => a.sequence - b.sequence);
    } catch (e) {
        console.error("便詳細取得エラー:", e);
        return [];
    }
}

/**
 * 2. バス停の統合時刻表を表示する関数 (バス停マーカーをクリックした時に使用)
 * 以前の showUnifiedTimetable の役割をこの中身で実行します
 */
async function showUnifiedTimetable(stopId) {
    console.log("1. 統合表示開始 stopId:", stopId);
    
    // HTML上の表示先要素を取得
    const container = document.getElementById('unified-timetable-container');
    if (!container) {
        console.error("エラー: ID 'unified-timetable-container' が見つかりません。index.htmlを確認してください。");
        return;
    }

    // 表示エリアを可視化し、読み込み中状態にする
    container.style.display = 'block';
    container.innerHTML = `<div style="padding:15px; background:#f9f9f9;">時刻表を読み込み中...</div>`;

    try {
        const stopName = window.stopLookup[stopId]?.name || `停留所ID: ${stopId}`;
        let results = [];

        // 有効なバス会社ごとにデータを検索
        for (const company of BUS_COMPANIES.filter(c => c.active)) {
            console.log(`2. ${company.name} のデータを抽出中...`);
            const res = await fetch(`${company.staticPath}stop_times.txt`);
            const text = await res.text();
            const lines = text.trim().split(/\r?\n/);
            
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const sIdx = head.indexOf('stop_id');
            const aIdx = head.indexOf('arrival_time');
            const hIdx = head.indexOf('stop_headsign');

            for (let i = 1; i < lines.length; i++) {
                // 文字列検索(includes)で絞り込んでから分割することで高速化
                if (lines[i].includes(stopId)) {
                    const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (cols[sIdx] === stopId) {
                        results.push({
                            time: cols[aIdx] ? cols[aIdx].substring(0, 5) : "--:--",
                            headsign: cols[hIdx] || "運行予定",
                            company: company.name
                        });
                    }
                }
            }
        }

        // 時刻順に並べ替え
        results.sort((a, b) => a.time.localeCompare(b.time));

        // 表示用HTMLの組み立て
        if (results.length === 0) {
            container.innerHTML = `<div style="padding:15px;"><h3>${stopName}</h3><p>本日の運行予定は見つかりませんでした。</p></div>`;
            return;
        }

        let html = `
            <div style="padding:15px; position:relative;">
                <button onclick="document.getElementById('unified-timetable-container').style.display='none'" 
                        style="position:absolute; right:10px; top:10px; padding:5px 10px;">✕</button>
                <h3 style="margin-top:0; border-bottom:2px solid #333; padding-bottom:5px;">${stopName}</h3>
                <table style="width:100%; border-collapse:collapse;">
                    <thead style="background:#eee; position:sticky; top:0;">
                        <tr>
                            <th style="padding:8px; text-align:left; border-bottom:1px solid #ccc;">時刻</th>
                            <th style="padding:8px; text-align:left; border-bottom:1px solid #ccc;">行先 / 会社</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        results.forEach(r => {
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px 8px; font-weight:bold; font-size:1.1em;">${r.time}</td>
                    <td style="padding:10px 8px;">
                        <div style="font-size:1em;">${r.headsign}</div>
                        <div style="font-size:0.75em; color:#777;">${r.company}</div>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
        console.log("3. 時刻表の描画が完了しました。");

    } catch (error) {
        console.error("時刻表取得中に致命的なエラーが発生:", error);
        container.innerHTML = `<div style="padding:15px; color:red;">エラーが発生しました。詳細はコンソールを確認してください。</div>`;
    }
}

// --- 他のJSファイルとの連携（グローバル登録） ---
window.showUnifiedTimetable = showUnifiedTimetable;
window.getFullTimetableForTrip = getFullTimetableForTrip;

console.log("✅ timetable.js の読み込みが完了しました");
