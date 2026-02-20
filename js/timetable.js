// js/timetable.js
let tripLookup = {};
let routeLookup = {};
let routeJpLookup = {};
let isGtfsReady = false;

async function prepareGtfsData() {
    try {
        const [rRes, tRes, rJpRes] = await Promise.all([
            fetch('./info/hiroden/routes.txt'),
            fetch('./info/hiroden/trips.txt'),
            fetch('./info/hiroden/routes_jp.txt')
        ]);
        
        const rText = await rRes.text();
        const tText = await tRes.text();
        const rJpText = await rJpRes.text();

        // 1. routes辞書
        const rRows = rText.trim().split(/\r?\n/);
        const rHead = rRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            routeLookup[c[rHead.indexOf('route_id')]] = {
                no: c[rHead.indexOf('route_short_name')],
                name: c[rHead.indexOf('route_long_name')]
            };
        });

        // 2. trips辞書
        const tRows = tText.trim().split(/\r?\n/);
        const tHead = tRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        tRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            tripLookup[c[tHead.indexOf('trip_id')]] = c[tHead.indexOf('route_id')];
        });

        // 3. routes_jp辞書 (buses.js用)
        const rJpRows = rJpText.trim().split(/\r?\n/);
        const rJpHead = rJpRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rJpRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            if (c.length > 1) {
                routeJpLookup[c[rJpHead.indexOf('route_id')]] = {
                    origin: c[rJpHead.indexOf('origin_stop')],
                    via: c[rJpHead.indexOf('via_stop')],
                    dest: c[rJpHead.indexOf('destination_stop')]
                };
            }
        });
        
        // 他のファイルから参照できるように共有
        window.routeJpLookup = routeJpLookup;
        window.tripLookup = tripLookup;
        window.routeLookup = routeLookup;

        isGtfsReady = true;
        console.log("✅ 全GTFS辞書準備完了");
    } catch (e) {
        console.error("辞書作成エラー:", e);
    }
}
prepareGtfsData();

async function getTimetableForStop(stopId) {
    while(!isGtfsReady) await new Promise(r => setTimeout(r, 100));

    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    
    try {
        const response = await fetch('./info/hiroden/stop_times.txt');
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let timetable = [];

        let idxTripId, idxDepTime, idxStopId;
        let isFirstChunk = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop();

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

                if (columns[idxStopId] === stopId) {
                    const depTime = columns[idxDepTime];
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
