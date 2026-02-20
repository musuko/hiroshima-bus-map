// js/timetable.js
let tripLookup = {};
let routeLookup = {};
let isGtfsReady = false;

// 起動時に辞書を作成
async function prepareGtfsData() {
    try {
        const [rRes, tRes] = await Promise.all([
            fetch('./hiroden/routes.txt'),
            fetch('./hiroden/trips.txt')
        ]);
        
        const rText = await rRes.text();
        const tText = await tRes.text();

        // routes辞書: route_id -> {no, name}
        const rRows = rText.trim().split(/\r?\n/);
        const rHead = rRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            routeLookup[c[rHead.indexOf('route_id')]] = {
                no: c[rHead.indexOf('route_short_name')],
                name: c[rHead.indexOf('route_long_name')]
            };
        });

        // trips辞書: trip_id -> route_id
        const tRows = tText.trim().split(/\r?\n/);
        const tHead = tRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        tRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            tripLookup[c[tHead.indexOf('trip_id')]] = c[tHead.indexOf('route_id')];
        });

        isGtfsReady = true;
        console.log("✅ 辞書準備完了");
    } catch (e) {
        console.error("辞書作成エラー:", e);
    }
}
prepareGtfsData();

async function getTimetableForStop(stopId) {
    // 辞書が準備できるまで待機（これがないと「不明」になる）
    while(!isGtfsReady) await new Promise(r => setTimeout(r, 100));

    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    
    try {
        const response = await fetch('./hiroden/stop_times.txt');
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let timetable = [];

        // ヘッダー解析用
        let idxTripId, idxDepTime, idxStopId;
        let isFirstChunk = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop(); // 切れ目処理

            for (const line of lines) {
                if (!line.trim()) continue;
                const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

                if (isFirstChunk) {
                    idxTripId = columns.indexOf('trip_id');
                    idxDepTime = columns.indexOf('departure_time');
                    idxStopId = columns.indexOf('stop_id');
                    isFirstChunk = false;
                    continue;
                }

                // stop_idが完全一致するか確認
                if (columns[idxStopId] === stopId) {
                    const depTime = columns[idxDepTime];
                    
                    // 現在時刻以降の便のみ
                    if (depTime >= currentTimeStr) {
                        const tripId = columns[idxTripId];
                        const routeId = tripLookup[tripId];
                        const routeInfo = routeLookup[routeId] || { no: "??", name: "不明" };

                        timetable.push({
                            time: depTime,
                            routeNo: routeInfo.no,
                            headsign: routeInfo.name
                        });
                    }
                }
            }
        }
        return timetable.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
        console.error("ストリーム読込エラー:", error);
        return [];
    }
}
