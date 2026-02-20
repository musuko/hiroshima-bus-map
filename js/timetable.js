// js/timetable.js
let tripLookup = {};
let routeLookup = {};
let isGtfsReady = false;

async function prepareGtfsData() {
    try {
        // routes.txt の解析
        const rRes = await fetch('./hiroden/routes.txt');
        const rText = await rRes.text();
        const rRows = rText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const rHead = rRows[0];
        
        rRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                routeLookup[cols[rHead.indexOf('route_id')]] = {
                    number: cols[rHead.indexOf('route_short_name')],
                    name: cols[rHead.indexOf('route_long_name')]
                };
            }
        });

        // trips.txt の解析
        const tRes = await fetch('./hiroden/trips.txt');
        const tText = await tRes.text();
        const tRows = tText.trim().split(/\r?\n/).map(row => row.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
        const tHead = tRows[0];

        tRows.slice(1).forEach(cols => {
            if (cols.length > 1) {
                tripLookup[cols[tHead.indexOf('trip_id')]] = cols[tHead.indexOf('route_id')];
            }
        });

        isGtfsReady = true;
        console.log("✅ 辞書準備完了");
    } catch (e) {
        console.error("❌ 準備エラー:", e);
    }
}

prepareGtfsData();

async function getTimetableForStop(stopId) {
    const txtPath = './hiroden/stop_times.txt';
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    try {
        const response = await fetch(txtPath);
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialData = '';
        let timetable = [];

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split(/\r?\n/);
            partialData = lines.pop();

            for (const line of lines) {
                if (line.includes(stopId)) {
                    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    
                    // 【超重要】ここで広電の stop_times.txt の列順を確認
                    // 標準: trip_id[0], arrival_time[1], departure_time[2], stop_id[3]
                    // もし columns[3] が ID でなければ、ここが原因です
                    if (columns.includes(stopId)) {
                        const tripId = columns[0]; // 1番目
                        const depTime = columns[2]; // 3番目
                        const routeId = tripLookup[tripId];
                        const routeInfo = routeLookup[routeId];

                        // 対象のバス停がクリックされたら詳細を表示
                        if (stopId === "51550 2") {
                            console.warn("--- [51550 2] 解析結果 ---");
                            console.log("生データ1行:", columns);
                            console.log("判定に使った tripId:", `|${tripId}|`); // 空白がないか確認用
                            console.log("辞書にあるか:", tripId in tripLookup);
                            console.log("見つかった routeId:", routeId);
                            console.log("見つかった routeInfo:", routeInfo);
                        }

                        if (depTime >= currentTimeStr) {
                            timetable.push({
                                time: depTime,
                                routeNo: routeInfo ? routeInfo.number : "",
                                headsign: routeInfo ? routeInfo.name : "不明"
                            });
                        }
                    }
                }
            }
        }
        return timetable.sort((a, b) => a.time.localeCompare(b.time));
    } catch (error) {
        return [];
    }
}
