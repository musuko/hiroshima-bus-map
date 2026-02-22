// js/timetable.js

if (typeof window.timetableCache === 'undefined') {
    window.timetableCache = {};
}

// 会社ごとのキャンセル用コントローラー
window.currentAborts = {};

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // 以前の同じ会社の実行があればキャンセルして二重動作を防ぐ
    if (window.currentAborts[companyId]) {
        window.currentAborts[companyId].abort();
    }
    window.currentAborts[companyId] = new AbortController();
    const signal = window.currentAborts[companyId].signal;

    // GTFSの準備ができるまで待機（最大10秒）
    let retry = 0;
    while (!window.isGtfsReady && retry < 100) {
        await new Promise(r => setTimeout(r, 100));
        retry++;
    }

    const cacheKey = `${companyId}_${stopId}`;
    if (window.timetableCache[cacheKey]) {
        return filterAndProcessTimetable(window.timetableCache[cacheKey], companyId);
    }

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return [];

        console.log(`🚀 ${company.name} スキャン開始: [${stopId}]`);
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
            if (signal.aborted) throw new Error('AbortError');

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

        console.log(`📊 ${company.name} 抽出結果: ${stopSpecificData.length} 件`);
        window.timetableCache[cacheKey] = stopSpecificData;
        return filterAndProcessTimetable(stopSpecificData, companyId);

    } catch (e) {
        if (e.name === 'AbortError' || e.message === 'AbortError') {
            console.log(`⏩ ${companyId} の旧リクエストをキャンセルしました`);
        } else {
            console.error("❌ 時刻表スキャンエラー:", e);
        }
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

    console.log(`✨ ${companyId} フィルタリング後: ${processed.length} 件`);
    return processed.sort((a, b) => a.time.localeCompare(b.time));
}

async function showUnifiedTimetable(stopId, companyIds, elementId) {
    // 宣言はここ一度だけ
    let container = null;

    // LeafletのポップアップがDOMに挿入されるまで待機
    for (let i = 0; i < 10; i++) {
        container = document.getElementById(elementId);
        if (container) break;
        await new Promise(r => setTimeout(r, 100));
    }
    
    if (!container) return;

    // ヘッダー部分の保存（「読み込み中...」の前の強調テキストなどを抽出）
    const originalHeader = container.innerHTML.split('<hr>')[0] || `<strong>時刻表</strong>`;

    try {
        const promises = companyIds.map(cid => getTimetableForStop(stopId, cid));
        const results = await Promise.all(promises);
        const combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

        if (combined.length === 0) {
            container.innerHTML = `${originalHeader}<hr><div style="padding:10px; color:#666;">本日の運行予定はありません</div>`;
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
            container.innerHTML = html;
        }
    } catch (e) {
        console.error("表示更新エラー:", e);
        container.innerHTML = `${originalHeader}<hr><div style="color:red;">時刻表の読み込みに失敗しました</div>`;
    }
}

window.showUnifiedTimetable = showUnifiedTimetable;
window.getTimetableForStop = getTimetableForStop;
