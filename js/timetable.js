// js/timetable.js

if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // 【修正】無限ループ防止：10秒経ってもGTFS準備ができなければ強制開始
    let retryCount = 0;
    while(!window.isGtfsReady && retryCount < 100) {
        await new Promise(r => setTimeout(r, 100));
        retryCount++;
    }

    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) {
        return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);
    }

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return []; // 会社がなければ即終了

        const response = await fetch(`${company.staticPath}stop_times.txt`);
        if (!response.ok) throw new Error("File not found");

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let stopSpecificData = [];

        let idxTripId, idxDepTime, idxStopId;
        let isFirstLine = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop(); 

            for (const line of lines) {
                if (!line.trim()) continue;
                const c = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
                
                if (isFirstLine) {
                    idxTripId = c.indexOf('trip_id');
                    idxDepTime = c.indexOf('departure_time');
                    idxStopId = c.indexOf('stop_id');
                    isFirstLine = false;
                    continue;
                }
                
                if (c[idxStopId] === stopId.trim()) {
                    stopSpecificData.push({ 
                        tripId: c[idxTripId], 
                        depTime: c[idxDepTime] 
                    });
                }
            }
        }

        window.timetableCache[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);
    } catch (e) {
        console.error("時刻表スキャンエラー:", e);
        return []; // エラー時は空配列を返して後続を生かす
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
