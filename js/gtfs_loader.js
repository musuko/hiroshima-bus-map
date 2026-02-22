// js/gtfs_loader.js

window.tripLookup = {};
window.routeLookup = {};
window.routeJpLookup = {};
window.isGtfsReady = false;
window.activeServiceIds = new Set();

async function prepareAllGtfsData() {
    try {
        const activeCompanies = BUS_COMPANIES.filter(c => c.active);

        const parse = (text, callback) => {
            const lines = text.trim().split(/\r?\n/);
            if (lines.length < 2) return;
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            for (let i = 1; i < lines.length; i++) {
                const columns = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (columns.length > 1) callback(columns, head);
            }
        };

        for (const company of activeCompanies) {
            console.log(`📦 GTFS辞書を作成中: ${company.name}`);

            const [rRes, tRes, rJpRes, cRes, cdRes] = await Promise.all([
                fetch(`${company.staticPath}routes.txt`),
                fetch(`${company.staticPath}trips.txt`),
                fetch(`${company.staticPath}routes_jp.txt`),
                fetch(`${company.staticPath}calendar.txt`),
                fetch(`${company.staticPath}calendar_dates.txt`)
            ]);

            const [rText, tText, rJpText, cText, cdText] = await Promise.all([
                rRes.text(), tRes.text(), rJpRes.text(), cRes.text(), cdRes.text()
            ]);

            // --- 1. 今日の日付判定 ---
            const now = new Date();
            const todayStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayDayName = dayNames[now.getDay()];

            // --- 2. 運行スケジュールの解析 (calendar.txt) ---
            parse(cText, (c, head) => {
                const sid = c[head.indexOf('service_id')];
                const startDate = c[head.indexOf('start_date')];
                const endDate = c[head.indexOf('end_date')];
                const isDayOn = c[head.indexOf(todayDayName)] === '1';

                if (todayStr >= startDate && todayStr <= endDate && isDayOn) {
                    const globalSid = `${company.id}_${sid}`;
                    window.activeServiceIds.add(globalSid);
                    console.log(`📅 有効なスケジュール: ${globalSid}`);
                }
            });

            // --- 2.5 祝日・臨時便の解析 (calendar_dates.txt) ---
            parse(cdText, (c, head) => {
                const sid = c[head.indexOf('service_id')];
                const date = c[head.indexOf('date')];
                const exceptionType = c[head.indexOf('exception_type')];
                const globalSid = `${company.id}_${sid}`;

                if (date === todayStr) {
                    if (exceptionType === '1') {
                        // 1: 追加（臨時運行など）
                        window.activeServiceIds.add(globalSid);
                        console.log(`📅 臨時運行追加: ${globalSid}`);
                    } else if (exceptionType === '2') {
                        // 2: 除外（祝日運休など）
                        window.activeServiceIds.delete(globalSid);
                        console.log(`📅 祝日・臨時運休: ${globalSid}`);
                    }
                }
            });

            // --- 3. 各種データの解析 ---
            parse(rText, (c, head) => {
                const globalId = `${company.id}_${c[head.indexOf('route_id')]}`;
                window.routeLookup[globalId] = {
                    no: c[head.indexOf('route_short_name')],
                    name: c[head.indexOf('route_long_name')],
                    companyId: company.id
                };
            });

            parse(tText, (c, head) => {
                const tripId = c[head.indexOf('trip_id')];
                const routeId = c[head.indexOf('route_id')];
                const serviceId = c[head.indexOf('service_id')];
            
                const globalTripId = `${company.id}_${tripId}`;
                const globalRouteId = `${company.id}_${routeId}`;
                const globalServiceId = `${company.id}_${serviceId}`;
            
                window.tripLookup[globalTripId] = { 
                    routeId: globalRouteId, 
                    serviceId: globalServiceId 
                };
            });

            parse(rJpText, (c, head) => {
                const globalId = `${company.id}_${c[head.indexOf('route_id')]}`;
                window.routeJpLookup[globalId] = {
                    origin: c[head.indexOf('origin_stop')],
                    dest: c[head.indexOf('destination_stop')],
                    jp_parent_route_id: c[head.indexOf('jp_parent_route_id')]
                };
            });
        }

        window.isGtfsReady = true;
        console.log("✅ 全社のGTFS辞書準備完了 (有効なサービス数: " + window.activeServiceIds.size + ")");
    } catch (e) {
        console.error("GTFS読み込みエラー:", e);
    }
}

prepareAllGtfsData();
