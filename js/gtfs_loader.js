// js/timetable.js
const timetableCache = {};

async function getTimetableForStop(stopId) {
    // 準備ができるまで待機
    while(!window.isGtfsReady) await new Promise(r => setTimeout(r, 100));

    if (timetableCache[stopId]) return filterAndProcessTimetable(timetableCache[stopId]);

    // 【課題】会社をまたぐ検索をどうするか？
    // 今はまず、configの最初の会社（広電など）を見に行くようにします
    const mainCompany = BUS_COMPANIES[0]; 
    
    try {
        const response = await fetch(`${mainCompany.staticPath}stop_times.txt`);
        // ... (ここから下のストリーム読み込みロジックは以前と同じ)
        // ただし、tripId を `${mainCompany.id}_${columns[idxTripId]}` に変換して保存
    } catch (e) { console.error(e); return []; }
}
