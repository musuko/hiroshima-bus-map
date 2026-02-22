/**
 * GTFSデータをロードして辞書を作成する
 */
async function loadGTFS() {
    window.activeServiceIds = new Set();
    window.tripLookup = {};
    window.routeLookup = {};
    window.stopLookup = {};

    // 今日の日付情報を取得
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = y + m + d; 
    const dayOfWeek = now.getDay(); 
    const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayWeekKey = weekDays[dayOfWeek];

    console.log(`🔍 判定開始: 今日は ${todayStr} (${todayWeekKey}) です`);

    for (const company of BUS_COMPANIES) {
        try {
            console.log(`📦 GTFS辞書を作成中: ${company.name}`);

            // 1. calendar.txt の処理 (運行スケジュールの判定)
            const calRes = await fetch(`${company.staticPath}calendar.txt`);
            const calText = await calRes.text();
            const calLines = calText.split(/\r?\n/);
            const calHeader = calLines[0].split(',').map(s => s.replace(/^"|"$/g, '').trim());

            const idxServiceId = calHeader.indexOf('service_id');
            const idxTodayWeek = calHeader.indexOf(todayWeekKey);
            const idxStart = calHeader.indexOf('start_date');
            const idxEnd = calHeader.indexOf('end_date');

            for (let i = 1; i < calLines.length; i++) {
                if (!calLines[i].trim()) continue;
                const c = calLines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
                
                const serviceId = c[idxServiceId];
                const isRunningOnDay = c[idxTodayWeek] === "1";

                // 【2026年対応】日付チェックをあえて行わず、曜日の合致だけで有効化
                if (isRunningOnDay) {
                    window.activeServiceIds.add(serviceId);
                }
            }

            // 2. calendar_dates.txt の処理 (祝日や運休の例外)
            try {
                const dateRes = await fetch(`${company.staticPath}calendar_dates.txt`);
                if (dateRes.ok) {
                    const dateText = await dateRes.text();
                    const dateLines = dateText.split(/\r?\n/);
                    const dateHeader = dateLines[0].split(',').map(s => s.replace(/^"|"$/g, '').trim());
                    const dIdxId = dateHeader.indexOf('service_id');
                    const dIdxDate = dateHeader.indexOf('date');
                    const dIdxType = dateHeader.indexOf('exception_type');

                    for (let i = 1; i < dateLines.length; i++) {
                        if (!dateLines[i].trim()) continue;
                        const c = dateLines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
                        
                        // 臨時運行・運休の日付が「今日」の場合のみ処理
                        if (c[dIdxDate] === todayStr) {
                            if (c[dIdxType] === "1") {
                                window.activeServiceIds.add(c[dIdxId]);
                            } else {
                                window.activeServiceIds.delete(c[dIdxId]);
                            }
                        }
                    }
                }
            } catch (e) { console.warn(`${company.name} の calendar_dates.txt はありません`); }

            // 3. trips.txt の処理 (便情報の登録)
            const tripRes = await fetch(`${company.staticPath}trips.txt`);
            const tripText = await tripRes.text();
            const tripLines = tripText.split(/\r?\n/);
            const tripHeader = tripLines[0].split(',').map(s => s.replace(/^"|"$/g, '').trim());
            const tIdxTripId = tripHeader.indexOf('trip_id');
            const tIdxRouteId = tripHeader.indexOf('route_id');
            const tIdxServiceId = tripHeader.indexOf('service_id');

            for (let i = 1; i < tripLines.length; i++) {
                if (!tripLines[i].trim()) continue;
                const c = tripLines[i].split(',').map(s => s.replace(/^"|"$/g, '').trim());
                const globalTripId = `${company.id}_${c[tIdxTripId]}`;
                window.tripLookup[globalTripId] = {
                    routeId: c[tIdxRouteId],
                    serviceId: c[tIdxServiceId]
                };
            }

            // 4. routes.txt / stops.txt の処理（既存と同様のため省略可）
            // ... ここに routes.txt と stops.txt の fetch 処理 ...

        } catch (err) {
            console.error(`${company.name} のロード失敗:`, err);
        }
    }

    console.log(`✅ 全社のGTFS辞書準備完了 (有効なサービス数: ${window.activeServiceIds.size})`);
}
