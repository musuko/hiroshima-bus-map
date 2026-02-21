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

        // routes辞書
        const rRows = rText.trim().split(/\r?\n/);
        const rHead = rRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        rRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            routeLookup[c[rHead.indexOf('route_id')]] = {
                no: c[rHead.indexOf('route_short_name')],
                name: c[rHead.indexOf('route_long_name')]
            };
        });

        // trips辞書
        const tRows = tText.trim().split(/\r?\n/);
        const tHead = tRows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        tRows.slice(1).forEach(row => {
            const c = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            tripLookup[c[tHead.indexOf('trip_id')]] = c[tHead.indexOf('route_id')];
        });

        // routes_jp辞書
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
    // 比較用に HH:mm:ss 形式を作る
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTimeStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}:00`;
    
    // パスを再確認：フォルダ分割版を試みる
    const folder = stopId.substring(0, 2);
    const url = `./info/hiroden/stop_times/${folder}/${stopId}.txt`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            // もし分割ファイルがない場合、一応コンソールに出す
            console.error(`ファイルが見つかりません: ${url}`);
            return [];
        }

        const text = await response.text();
        const lines = text.trim().split(/\r?\n/);
        const header = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        
        const idxTripId = header.indexOf('trip_id');
        const idxDepTime = header.indexOf('departure_time');

        let timetable = [];

        // js/timetable.js (中盤のループ部分)

        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const depTime = columns[idxDepTime];
            if (!depTime) continue;

            // 【テスト用】時刻の比較をせず、全部 push する
            if (true) { 
                const tripId = columns[idxTripId];
                const routeId = tripLookup[tripId];
                const routeInfo = routeLookup[rowId] || { no: "??", name: "不明" };

                timetable.push({
                    time: depTime.substring(0, 5),
                    routeNo: routeInfo.no,
                    headsign: routeInfo.name
                });
            }
        }

        // 時間順に並び替え
        return timetable.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
        console.error("時刻表取得エラー:", error);
        return [];
    }
}
window.getTimetableForStop = getTimetableForStop;
