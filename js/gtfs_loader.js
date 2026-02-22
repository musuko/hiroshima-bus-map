// js/gtfs_loader.js

// 全社共通の器を window に用意
window.tripLookup = {};
window.routeLookup = {};
window.routeJpLookup = {};
window.isGtfsReady = false;

async function prepareAllGtfsData() {
    try {
        const activeCompanies = BUS_COMPANIES.filter(c => c.active);

        for (const company of activeCompanies) {
            console.log(`📦 GTFS辞書を作成中: ${company.name}`);

            const [rRes, tRes, rJpRes] = await Promise.all([
                fetch(`${company.staticPath}routes.txt`),
                fetch(`${company.staticPath}trips.txt`),
                fetch(`${company.staticPath}routes_jp.txt`)
            ]);

            const [rText, tText, rJpText] = await Promise.all([
                rRes.text(), tRes.text(), rJpRes.text()
            ]);

            const parse = (text, callback) => {
                const lines = text.trim().split(/\r?\n/);
                const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                for (let i = 1; i < lines.length; i++) {
                    const columns = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                    if (columns.length > 1) callback(columns, head);
                }
            };

            // routes解析 (IDに会社名を付与)
            parse(rText, (c, head) => {
                const globalId = `${company.id}_${c[head.indexOf('route_id')]}`;
                window.routeLookup[globalId] = {
                    no: c[head.indexOf('route_short_name')],
                    name: c[head.indexOf('route_long_name')],
                    companyId: company.id
                };
            });

            // trips解析
            parse(tText, (c, head) => {
                const globalTripId = `${company.id}_${c[head.indexOf('trip_id')]}`;
                const globalRouteId = `${company.id}_${c[head.indexOf('route_id')]}`;
                window.tripLookup[globalTripId] = globalRouteId;
            });

            // routes_jp解析
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
        console.log("✅ 全社のGTFS辞書準備完了");
    } catch (e) {
        console.error("GTFS読み込みエラー:", e);
    }
}

prepareAllGtfsData();
