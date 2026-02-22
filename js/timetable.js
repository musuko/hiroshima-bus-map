// js/timetable.js

window.currentAborts = {}; // 会社ごとのキャンセル用コントローラー

if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // 古い実行があればキャンセル
    if (window.currentAborts[companyId]) {
        window.currentAborts[companyId].abort();
    }
    window.currentAborts[companyId] = new AbortController();
    const signal = window.currentAborts[companyId].signal;

    while(!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        const response = await fetch(`${company.staticPath}stop_times.txt`, { signal });
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = [];
        let isFirstLine = true;
        let idxTripId, idxDepTime, idxStopId;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            // キャンセルされたかチェック
            if (signal.aborted) throw new Error('aborted');

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop(); 

            for (const line of lines) {
                const c = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
                if (isFirstLine) {
                    idxTripId = c.indexOf('trip_id');
                    idxDepTime = c.indexOf('departure_time');
                    idxStopId = c.indexOf('stop_id');
                    isFirstLine = false; continue;
                }
                if (c[idxStopId] === stopId.trim()) {
                    stopSpecificData.push({ tripId: c[idxTripId], depTime: c[idxDepTime] });
                }
            }
        }
        window.timetableCache[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);
    } catch (e) {
        if (e.name === 'AbortError') console.log(`⏩ ${companyId} の旧リクエストをキャンセルしました`);
        else console.error("スキャンエラー:", e);
        return [];
    }
}

function filterAndProcessTimetable(data, companyId) {
    if (!window.activeServiceIds || !window.tripLookup) return [];

    const processed = data.map(item => {
        const globalTripId = `${companyId}_${item.tripId}`;
        const tripData = window.tripLookup[globalTripId];
        if (!tripData) return null;

        const isActive = window.activeServiceIds.has(tripData.serviceId);
        if (!isActive) return null;

        const routeId = tripData.routeId;
        const routeInfo = window.routeLookup[routeId] || { no: "??", name: "不明" };

        return {
            time: item.depTime.substring(0, 5),
            routeNo: routeInfo.no,
            headsign: routeInfo.name,
            companyId: companyId
        };
    }).filter(v => v !== null);

    return processed.sort((a, b) => a.time.localeCompare(b.time));
}

async function showUnifiedTimetable(stopId, companyIds, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    // IDをコンソールに出して、データ不一致がないか確認しやすくする
    console.log(`🔍 時刻表リクエスト受信: StopID[${stopId}] Companies[${companyIds}]`);
    // 【修正】要素取得のタイムアウト設定
    let container = null;
    for (let i = 0; i < 10; i++) {
        container = document.getElementById(elementId);
        if (container) break;
        await new Promise(r => setTimeout(r, 100));
    }
    
    if (!container) return;

    // ヘッダー（駅名など）を取得して保存
    const originalHeader = container.innerHTML.split('<hr>')[0] || `<strong>時刻表 (ID: ${stopId})</strong>`;

    try {
        // 並列で取得を開始
        const results = await Promise.all(companyIds.map(cid => getTimetableForStop(stopId, cid)));
        const combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            container.innerHTML = `${originalHeader}<hr><div style="padding:10px; color:#666;">本日の運行予定はありません</div>`;
        } else {
            let html = `${originalHeader}<hr><div style="max-height:250px; overflow-y:auto;">`;
            html += `<table style="width:100%; font-size:12px; border-collapse:collapse;">`;
            combined.forEach(item => {
                const color = (item.companyId === 'hirobus') ? '#e60012' : '#82c91e';
                html += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 0; font-weight:bold; width:45px;">${item.time}</td>
                    <td style="padding:6px 2px; width:40px;"><span style="background:${color}; color:#fff; padding:2px 4px; border-radius:3px; font-weight:bold;">${item.routeNo}</span></td>
                    <td style="padding:6px 0;">${item.headsign}</td>
                </tr>`;
            });
            html += `</table></div>`;
            container.innerHTML = html;
        }
    } catch (e) {
        console.error("表示更新エラー:", e);
        container.innerHTML = `${originalHeader}<hr>読み込み中にエラーが発生しました。`;
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
window.getTimetableForStop = getTimetableForStop;
