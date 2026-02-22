// js/timetable.js

/**
 * 1. 便の全停留所を取得する関数 (バス車両用)
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
 * 2. 統合時刻表を表示する関数 (バス停用)
 * calendar.js を使用して今日のダイヤのみを表示します
 */
async function showUnifiedTimetable(stopId) {
    console.log("1. 統合表示開始 stopId:", stopId);
    
    const container = document.querySelector('.leaflet-popup-content');
    if (!container) return;

    container.innerHTML = `<div style="min-width:200px;">本日の時刻表を抽出中...</div>`;

    try {
        const stopName = window.stopLookup[stopId]?.name || `停留所(${stopId})`;
        const dayInfo = window.CalendarManager.getDayLabel();
        let results = [];

        for (const company of BUS_COMPANIES.filter(c => c.active)) {
            // --- ステップA: 今日有効な service_id を取得 (calendar.js) ---
            const activeServices = await window.CalendarManager.getTodayServiceIds(company);
            if (activeServices.length === 0) continue;

            // --- ステップB: 今日有効な trip_id を抽出 (trips.txt) ---
            const tripRes = await fetch(`${company.staticPath}trips.txt`);
            const tripText = await tripRes.text();
            const tripLines = tripText.trim().split(/\r?\n/);
            const tripHead = tripLines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            
            const tTripIdx = tripHead.indexOf('trip_id');
            const tServiceIdx = tripHead.indexOf('service_id');
            
            // Setを使って高速に照合
            const todayTripIds = new Set();
            for (let i = 1; i < tripLines.length; i++) {
                const cols = tripLines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (activeServices.includes(cols[tServiceIdx])) {
                    todayTripIds.add(cols[tTripIdx]);
                }
            }

            // --- ステップC: stop_times.txt から今日の便の時刻を抽出 ---
            const stRes = await fetch(`${company.staticPath}stop_times.txt`);
            const stText = await stRes.text();
            const stLines = stText.trim().split(/\r?\n/);
            const stHead = stLines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            
            const sIdx = stHead.indexOf('stop_id');
            const aIdx = stHead.indexOf('arrival_time');
            const hIdx = stHead.indexOf('stop_headsign');
            const tIdx = stHead.indexOf('trip_id');

            for (let i = 1; i < stLines.length; i++) {
                // stopId が含まれる行のみ詳細解析して高速化
                if (stLines[i].includes(stopId)) {
                    const cols = stLines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    // IDが一致し、かつ「今日の便(trip_id)」であること
                    if (cols[sIdx] === stopId && todayTripIds.has(cols[tIdx])) {
                        results.push({
                            time: cols[aIdx] ? cols[aIdx].substring(0, 5) : "--:--",
                            headsign: cols[hIdx] || "運行予定",
                            company: company.name
                        });
                    }
                }
            }
        }

        // --- ステップD: ソートと描画 ---
        results.sort((a, b) => a.time.localeCompare(b.time));

        let html = `
            <div style="max-height:300px; overflow-y:auto; min-width:220px;">
                <div style="padding-bottom:5px; border-bottom:2px solid ${dayInfo.color}; margin-bottom:5px;">
                    <strong style="font-size:1.1em;">${stopName}</strong><br>
                    <span style="font-size:0.85em; color:${dayInfo.color}; font-weight:bold;">${dayInfo.label}ダイヤ</span>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">`;
        
        if (results.length === 0) {
            html += `<tr><td style="padding:10px; color:#999;">本日の運行はありません。</td></tr>`;
        } else {
            results.forEach(r => {
                html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px 0; font-weight:bold; width:50px;">${r.time}</td>
                        <td style="padding:6px 5px;">
                            ${r.headsign} <br>
                            <small style="color:#888;">${r.company}</small>
                        </td>
                    </tr>`;
            });
        }

        container.innerHTML = html + `</table></div>`;
        console.log("3. 表示完了（曜日判定済）");

    } catch (error) {
        console.error("時刻表エラー:", error);
        container.innerHTML = "読込エラーが発生しました。";
    }
}

// --- 連携登録 ---
window.getFullTimetableForTrip = getFullTimetableForTrip;
window.showUnifiedTimetable = showUnifiedTimetable;

console.log("✅ timetable.js の読み込みが完了しました");
