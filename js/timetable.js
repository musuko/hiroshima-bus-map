// js/timetable.js

// キャッシュをあえて定義しない、または常に空にする
window.activeDisplayStopId = "";
window.currentAborts = {};

async function getTimetableForStop(stopId, companyId = 'hiroden') {
    // 常に新しい通信・解析を行う
    if (window.currentAborts[companyId]) {
        window.currentAborts[companyId].abort();
    }
    window.currentAborts[companyId] = new AbortController();
    const signal = window.currentAborts[companyId].signal;

    // GTFSのロード待ち
    while (!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    try {
        const company = BUS_COMPANIES.find(c => c.id === companyId);
        if (!company) return [];

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
        return filterAndProcessTimetable(stopSpecificData, companyId);
    } catch (e) {
        return [];
    }
}

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
            companyId: companyId 
        };
    }).filter(v => v !== null);
}

async function showUnifiedTimetable(stopId, companyIds, elementId) {
    // 実行中のターゲットをセット
    window.activeDisplayStopId = stopId;
    
    // 1. ポップアップ要素が画面に出現するのを待つ
    let container = null;
    for (let i = 0; i < 15; i++) {
        container = document.getElementById(elementId);
        if (container) break;
        await new Promise(r => setTimeout(r, 100));
    }
    if (!container) return;

    // 2. 以前の残骸をクリアして「読み込み中」を明示
    const originalHeader = container.innerHTML.split('<hr>')[0] || `<strong>時刻表</strong>`;
    container.innerHTML = `${originalHeader}<hr><div class="loading-msg">時刻表を読み込み中...</div>`;

    try {
        // 並列取得
        const promises = companyIds.map(cid => getTimetableForStop(stopId, cid));
        const results = await Promise.all(promises);

        // 3. 取得完了後の整合性チェック
        // ポップアップが閉じられたか、別のバス停が選ばれていたら中断
        if (window.activeDisplayStopId !== stopId || !document.getElementById(elementId)) {
            return;
        }

        let combined = results.flat().sort((a, b) => a.time.localeCompare(b.time));

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
        console.error("表示エラー:", e);
    }
}

// マップのどこかをクリックしたり、ポップアップを閉じたりした時のリセット用
// stops.js などでポップアップを生成する際、
// map.on('popupclose', () => { window.activeDisplayStopId = ""; }); 
// を入れるとより完璧です。

window.showUnifiedTimetable = showUnifiedTimetable;
