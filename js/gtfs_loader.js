/**
 * js/gtfs_loader.js
 * 役割: 「バス停名」と「系統情報」をメモリに読み込む
 */

window.stopLookup = window.stopLookup || {};
window.tripLookup = window.tripLookup || {};
window.routeLookup = window.routeLookup || {};
window.routeJpLookup = window.routeJpLookup || {};
window.tripToShapeLookup = window.tripToShapeLookup || {};
window.companyGtfsCache = window.companyGtfsCache || {};
window.isGtfsReady = false;
// ===== Global Loading Manager =====
window.LoadingManager = {
  count: 0,

  start() {
    this.count++;
    this.update();
  },

  end() {
    this.count = Math.max(0, this.count - 1);
    this.update();
  },

  update() {
    const el = document.getElementById("loading-overlay");
    if (!el) return;

    if (this.count > 0) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  },
};

// 汎用ファイルローダー作る
async function loadGtfsTextFiles(company, baseFileName) {
  const texts = [];

  try {
    // パターン1：通常ファイル
    const res = await fetch(`${company.staticPath}${baseFileName}.txt`);

    if (res.ok) {
      texts.push(await res.text());
      return texts;
    }

    // パターン2：分割ファイル
    let fileIndex = 1;

    while (true) {
      const splitRes = await fetch(
        `${company.staticPath}${baseFileName}_${fileIndex}.txt`,
      );

      if (!splitRes.ok) break;

      texts.push(await splitRes.text());
      fileIndex++;
    }

    return texts;
  } catch (e) {
    console.error(`${baseFileName} load error:`, e);
    return [];
  }
}

// グローバル登録
window.loadGtfsTextFiles = loadGtfsTextFiles;

// ★1つの会社のデータだけを読み込む関数
window.loadCompanyGtfsData = async function (company) {
  if (company.isGtfsLoaded) return; // 既にロード済みならスキップ
  console.log(`🚀 ${company.name} のGTFSデータを読み込み中...`);

  // --- A. stops.txt の読み込み ---
  try {
    const res = await fetch(`${company.staticPath}stops.txt`);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);

      const head = lines[0]
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""));

      const sIdIdx = head.indexOf("stop_id");
      const sNameIdx = head.indexOf("stop_name");
      const latIdx = head.indexOf("stop_lat");
      const lonIdx = head.indexOf("stop_lon");

      if (sIdIdx === -1 || latIdx === -1 || lonIdx === -1) {
        console.error("必要な列が見つかりません");
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const cols = lines[i]
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""));

        if (!cols[sIdIdx]) continue;

        const stopId = cols[sIdIdx].trim();
        const stopName = cols[sNameIdx] || "名称不明";
        const stopLat = parseFloat(cols[latIdx]);
        const stopLon = parseFloat(cols[lonIdx]);
        // stopLookup[stopId]が存在しない場合
        if (!window.stopLookup[stopId]) {
          // stopLookupの定義。stopIdをキーに、stop_name, stop_lat, stop_lon, companiesの配列を保存
          window.stopLookup[stopId] = {
            name: stopName,
            lat: stopLat,
            lon: stopLon,
            companies: [company.id],
          };
          // stopLookup[stopId]が存在する場合
        } else {
          const existing = window.stopLookup[stopId];

          if (existing.lat == null) existing.lat = stopLat;
          if (existing.lon == null) existing.lon = stopLon;
          // console.log("stopLat", stopLat);
          // console.log("existing.lat", existing.lat);
          // console.log("window.stopLookup[stopId].lat", window.stopLookup[stopId].lat);

          // 緯度経度が同じなら会社IDだけ追加（異なる場合は同一IDの別バス停の可能性があるので追加しない）
          if (
            stopLat === window.stopLookup[stopId].lat &&
            stopLon === window.stopLookup[stopId].lon
          ) {
            existing.companies.push(company.id);
            console.log("pushされたexisting.companiesは", existing.companies);
          }
          // if (!existing.companies.includes(company.id)) {
          //     existing.companies.push(company.id);
          //     console.log("pushされたexisting.companiesは", existing.companies);//////////////
          // }
        }
        console.log("確認中");
      }
    }
  } catch (e) {
    console.error(`${company.name} stops.txt 読込失敗:`, e);
  }

  // --- B. routes.txt の読み込み ---
  try {
    const res = await fetch(`${company.staticPath}routes.txt`);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);
      const head = lines[0]
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""));

      const rIdIdx = head.indexOf("route_id");
      const rShortIdx = head.indexOf("route_short_name");
      const rLongIdx = head.indexOf("route_long_name");

      window.routeLookup[company.id] = {};

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""));
        if (cols.length > rIdIdx && cols[rIdIdx]) {
          const routeId = cols[rIdIdx].trim();
          window.routeLookup[company.id][routeId] = {
            shortName: cols[rShortIdx] || "",
            longName: cols[rLongIdx] || "路線情報なし",
          };
        }
      }
    }
  } catch (e) {
    console.error(`${company.name} routes.txt 読込失敗:`, e);
  }

  // --- 【ここから追加】C. trips.txt の読み込み (trip_id と shape_id の紐付け) ---
  try {
    const resTrips = await fetch(`${company.staticPath}trips.txt`);
    if (resTrips.ok) {
      const textTrips = await resTrips.text();
      const linesTrips = textTrips.trim().split(/\r?\n/);

      // ヘッダーの解析（ダブルクォーテーションを除去）
      const headTrips = linesTrips[0]
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""));
      const tIdIdx = headTrips.indexOf("trip_id");
      const sIdIdx = headTrips.indexOf("shape_id");

      // trip_id と shape_id の列が存在する場合のみ処理
      if (tIdIdx >= 0 && sIdIdx >= 0) {
        for (let i = 1; i < linesTrips.length; i++) {
          if (!linesTrips[i].trim()) continue; // 空行スキップ

          // カンマ分割（簡易版。trips.txtは通常カンマを含まないのでこれで安全です）
          const cols = linesTrips[i].split(",");
          if (cols.length > Math.max(tIdIdx, sIdIdx)) {
            const tripId = cols[tIdIdx].trim().replace(/^"|"$/g, "");
            const shapeId = cols[sIdIdx].trim().replace(/^"|"$/g, "");

            if (tripId && shapeId) {
              // グローバルな検索用オブジェクトに保存（例: "hiroden_12345": "shape_A"）
              window.tripToShapeLookup[`${company.id}_${tripId}`] = shapeId;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`${company.name} trips.txt 読込失敗:`, e);
  }

  company.isGtfsLoaded = true; // 読み込み完了フラグを立てる
};

// ★起動時に呼び出される関数（表示ONの会社だけをロードする）
window.prepareAllGtfsData = async function () {
  LoadingManager.start();

  try {
    const promises = window.BUS_COMPANIES.filter(
      (c) => c.active && c.visible !== false,
    ).map((c) => window.loadCompanyGtfsData(c));

    await Promise.all(promises);

    window.isGtfsReady = true;
    console.log("🏁 初期のGTFSデータロードが完了しました");
  } finally {
    LoadingManager.end();
  }
};
