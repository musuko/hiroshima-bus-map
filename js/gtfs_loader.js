// js/gtfs_loader.js

// グローバル辞書（最初は空）
window.gtfsCache = {}; // 会社ごとのデータを格納

async function prepareAllGtfsData() {
    console.log("🚀 起動プロセス: 最小限のデータで開始します");
    
    for (const company of BUS_COMPANIES.filter(c => c.active)) {
        try {
            // 起動時に読み込むのは stops.txt だけ！
            const res = await fetch(`${company.staticPath}stops.txt`);
            const text = await res.text();
            
            // 既存の stops.js 等が使う window.stopLookup だけ作成
            const lines = text.trim().split(/\r?\n/);
            const head = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const sIdIdx = head.indexOf('stop_id');
            const sNameIdx = head.indexOf('stop_name');

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                if (cols.length > 1) {
                    window.stopLookup[cols[sIdIdx]] = { name: cols[sNameIdx] };
                }
            }
            console.log(`✅ ${company.name} の停留所配置完了`);
        } catch (e) {
            console.error(`${company.name} の起動読込失敗:`, e);
        }
    }
    window.isGtfsReady = true; 
}

/**
 * 【重要】バスをクリックした時に呼び出す「詳細データ読み込み」関数
 */
async function loadDetailedGtfsIfNeeded(companyId) {
    // すでに読み込み済みなら何もしない
    if (window.gtfsCache[companyId]) return window.gtfsCache[companyId];

    const company = BUS_COMPANIES.find(c => c.id === companyId);
    console.log(`📦 ${company.name} の詳細データをバックグラウンドで読み込み中...`);

    // 必要なファイルだけをこのタイミングで取得
    const files = ['routes.txt', 'trips.txt', 'routes_jp.txt', 'calendar.txt'];
    const data = {};

    await Promise.all(files.map(async file => {
        try {
            const res = await fetch(`${company.staticPath}${file}`);
            data[file] = await res.text();
        } catch (e) { console.warn(`${file} の取得失敗`); }
    }));

    // ここで初めて辞書（tripLookupなど）を構築する処理を行う
    // (解析ロジックは以前の parse 関数と同じものを使用)
    // ... 解析して window.tripLookup 等へ追加 ...

    window.gtfsCache[companyId] = true; // 完了フラグ
    return true;
}

prepareAllGtfsData();
