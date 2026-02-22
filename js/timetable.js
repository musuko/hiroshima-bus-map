// js/timetable.js

if (!window.timetableDataStore) {
    window.timetableDataStore = {}; 
}
window.activeDisplayStopId = "";

/**
 * バス停用の時刻表データを取得する (既存の機能)
 */
async function getFullTimetableForTrip(tripId, companyId) {
    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return [];

        const response = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        
        const header = lines[0].split(',').map(s => s.replace(/^"|"$/g, '').trim());
        const idxTripId = header.indexOf('trip_id');
        const idxArrivalTime = header.indexOf('arrival_time');
        const idxStopId = header.indexOf('stop_id');
        const idxStopSeq = header.indexOf('stop_sequence');

        let tripStops = [];

        // デバッグ用：検索するIDをログ出力
        console.log(`Searching Static for: ${tripId}`);

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const c = lines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
            
            // IDが完全一致するか、リアルタイムIDがファイル内IDに含まれているか（部分一致）
            if (c[idxTripId] === tripId || c[idxTripId].includes(tripId)) {
                const stopId = c[idxStopId];
                
                // 【重要：修正箇所】stopLookupの存在チェックを厳重に
                let stopName = `不明な停留所 (${stopId})`;
                if (window.stopLookup && window.stopLookup[stopId]) {
                    stopName = window.stopLookup[stopId].name;
                }
                
                tripStops.push({
                    stopName: stopName,
                    time: (c[idxArrivalTime] || "??:??").substring(0, 5),
                    sequence: parseInt(c[idxStopSeq])
                });
            }
        }

        return tripStops.sort((a, b) => a.sequence - b.sequence);
    } catch (e) {
        console.error("便別時刻表取得エラー:", e);
        return [];
    }
}
/**
 * 特定の便 (tripId) の全停留所時刻表を取得する (新規追加分)
 */
async function getFullTimetableForTrip(tripId, companyId) {
    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return [];

        const response = await fetch(`${company.staticPath}stop_times.txt`);
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        
        const header = lines[0].split(',').map(s => s.replace(/^"|"$/g, '').trim());
        const idxTripId = header.indexOf('trip_id');
        const idxArrivalTime = header.indexOf('arrival_time');
        const idxStopId = header.indexOf('stop_id');
        const idxStopSeq = header.indexOf('stop_sequence');

        let tripStops = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const c = lines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
            
            if (c[idxTripId] === tripId) {
                const stopId = c[idxStopId];
                // window.stopLookup を利用して名称変換
                const stopInfo = window.stopLookup[stopId] || { name: `ID:${stopId}` };
                
                tripStops.push({
                    stopName: stopInfo.name,
                    time: c[idxArrivalTime].substring(0, 5),
                    sequence: parseInt(c[idxStopSeq])
                });
            }
        }
        return tripStops.sort((a, b) => a.sequence - b.sequence);
    } catch (e) {
        console.error("便別時刻表取得エラー:", e);
        return [];
    }
}

/**
 * データのフィルタリング・整形
 */
function filterAndProcessTimetable(data, companyId) {
    if (!window.activeServiceIds || !window.tripLookup) return [];
    return data.map(item => {
        const globalTripId = `${companyId}_${item.tripId}`;
        const tripData = window.tripLookup[globalTripId];
        if (!tripData || !window.activeServiceIds.has(tripData.serviceId)) return null;
        const routeInfo = window.routeLookup[tripData.routeId] || { no: "??", name: "不明" };
        return { 
            time: item.depTime.substring(0, 5), 
            routeNo: routeInfo.no, 
            headsign: routeInfo.name, 
            companyId: companyId,
            tripId: item.tripId // 後でバス詳細に飛ばす場合に便利
        };
    }).filter(v => v !== null);
}

/**
 * バス停クリック時の統合表示
 */
async function showUnifiedTimetable(stopId, companyIds, elementId) {
    window.activeDisplayStopId = stopId;
    
    let container = null;
    for (let i = 0; i < 30; i++) {
        container = document.getElementById(elementId);
        if (container && container.innerHTML.includes('読み込み中')) break;
        await new Promise(r => setTimeout(r, 100));
    }
    
    if (!container) return;

    try {
        const results = await Promise.all(companyIds.map(cid => getTimetableForStop(stopId, cid)));
        if (window.activeDisplayStopId !== stopId) return;

        const finalContainer = document.getElementById(elementId);
        if (!finalContainer) return;

        const originalHeader = finalContainer.innerHTML.split('<hr>')[0] || `<strong>時刻表</strong>`;
        let combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            finalContainer.innerHTML = `${originalHeader}<hr><div style="padding:10px; color:#666;">本日の運行予定はありません</div>`;
        } else {
            let html = `${originalHeader}<hr><div style="max-height:250px; overflow-y:auto;">`;
            html += `<table style="width:100%; font-size:12px; border-collapse:collapse; background:white;">`;
            combined.forEach(item => {
                const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
                html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px 0; font-weight:bold; width:45px; color:#333;">${item.time}</td>
                    <td style="padding:8px 2px; width:40px;"><span style="background:${color}; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold; font-size:10px;">${item.routeNo}</span></td>
                    <td style="padding:8px 0; color:#444;">${item.headsign}</td>
                </tr>`;
            });
            html += `</table></div>`;
            finalContainer.innerHTML = html;
        }
    } catch (e) {
        console.error("Render Error:", e);
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
window.getTimetableForStop = getTimetableForStop; // 公開
window.getFullTimetableForTrip = getFullTimetableForTrip; // 公開
