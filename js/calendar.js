// js/trip_details.js

/**
 * 便の全停留所を取得する関数 (バス車両用)
 * リトライ監視を追加し、ポップアップへの書き込みタイミングを安定させます
 */
async function getFullTimetableForTrip(tripId, companyId) {
    if (!tripId) return [];
    const company = BUS_COMPANIES.find(c => c.id === companyId);
    if (!company) return [];

    // --- 【タイミング修正】ポップアップ要素が現れるのを待つ (リトライ監視) ---
    // Leafletのポップアップ生成とJSの実行速度の差を埋めます
    let container = null;
    for (let i = 0; i < 10; i++) { // 最大0.5秒間チェック
        container = document.querySelector('.leaflet-popup-content');
        if (container) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
        // 1. 今日の有効な service_id を取得 (calendar.js を利用)
        const activeServices = await window.CalendarManager.getTodayServiceIds(company);
        
        // 2. trips.txt を読み込み、対象の便が今日の運行か確認
        const tripRes = await fetch(`${company.staticPath}trips.txt`);
        const tripText = await tripRes.text();
        const tripLines = tripText.trim().split(/\r?\n/);
        const tripHead = tripLines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const tTripIdx = tripHead.indexOf('trip_id');
        const tServiceIdx = tripHead.indexOf('service_id');

        // service_id によるフィルタリング
        const tripInfo = tripLines.find(line => line.includes(tripId));
        if (tripInfo) {
            const cols = tripInfo.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (cols[tTripIdx] === tripId && !activeServices.includes(cols[tServiceIdx])) {
                console.warn("この便は今日の運行ダイヤ（service_id）に含まれません:", tripId);
                return []; 
            }
        }

        // 3. stop_times.txt から全停留所を抽出
        const res = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await res.text();
        const lines = text.trim().split(/\r?\n/);
        const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

        const sIdx = head.indexOf('stop_id');
        const aIdx = head.indexOf('arrival_time');
        const sqIdx = head.indexOf('stop_sequence');
        const tIdx = head.indexOf('trip_id');

        const tripStops = [];
        for (let i = 1; i < lines.length; i++) {
            // tripIdが含まれる行だけを抽出
            if (lines[i].includes(tripId)) {
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
        }

        // 停留所順に並び替え
        return tripStops.sort((a, b) => a.sequence - b.sequence);

    } catch (e) {
        console.error("便詳細取得中にエラーが発生しました:", e);
        return [];
    }
}

// グローバル登録
window.getFullTimetableForTrip = getFullTimetableForTrip;
console.log("✅ trip_details.js (リトライ監視付) の読み込みが完了しました");
