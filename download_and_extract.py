import datetime
import io
import os
import csv
import urllib.request
import zipfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_BASE_DIR = os.path.join(BASE_DIR, "data")

# 【設定】バス会社URLリスト
BUS_DATA_LIST = [
    {"name": "hiroden", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/8/current_data.zip"},
    {"name": "hiroshimabus", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/9/current_data.zip"},
    {"name": "hirokotsu", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/10/current_data.zip"},
    {"name": "geiyo", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/11/current_data.zip"},
    {"name": "bihoku", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/12/current_data.zip"},
    {"name": "jrbus", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/15/current_data.zip"},
    {"name": "hdnishihiroshima", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/13/current_data.zip"},
    {"name": "forble", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/14/current_data.zip"},
    {"name": "sasaki", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/17/current_data.zip"},
    {"name": "kurebus", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/18/current_data.zip"},
    {"name": "hatsukaichi", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/19/current_data.zip"},
    {"name": "asahi", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/54/current_data.zip"},
    {"name": "onomichi", "url": "https://ajt-mobusta-gtfs.mcapps.jp/static/53/current_data.zip"},
    {"name": "etajimabus", "url": "https://gtfs-st.busit.jp/api/etajimabus/"},
    {"name": "chugokubus", "url": "https://bus-vision.jp/gtfs_v2/chugokubus/gtfsFeed"},
    {"name": "tomotetsu", "url": "https://bus-vision.jp/gtfs_v2/tomotetsubus/gtfsFeed"},
    {"name": "ikasabus", "url": "https://bus-vision.jp/gtfs_v2/ikasabus/gtfsFeed"},
]

# 大竹市の3路線（統合対象）
OHTAKE_SOURCES = [
    {"name": "ohtake_kuritani", "url": "https://hiroshima-opendata.dataeye.jp/resource_download/10046"},
    {"name": "ohtake_sakaue", "url": "https://hiroshima-opendata.dataeye.jp/resource_download/10047"},
    {"name": "ohtake_koikoi", "url": "https://hiroshima-opendata.dataeye.jp/resource_download/10045"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def download_zip(url, name):
    """URLからZIPをダウンロドしてbytesを返す"""
    print(f"  → ダウンロード中: {name}")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def read_csv_from_zip(zip_bytes, filename):
    """ZIP bytesから指定ファイル名のCSVを読み込み、ヘッダー行とデータ行のリストを返す"""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        if filename not in zf.namelist():
            return None, []
        with zf.open(filename) as f:
            # UTF-8で読み込み（BOM対応）
            text = f.read().decode('utf-8-sig')
            reader = csv.reader(io.StringIO(text))
            rows = list(reader)
            if not rows:
                return None, []
            return rows[0], rows[1:]


def merge_gtfs_files(sources):
    """複数のGTFS ZIPを1つに統合する。返り値は {filename: [header, ...rows]} のdict"""
    merged = {}
    stops_dict = {}  # stop_id -> row（重複排除用）
    agency_header = None
    agency_row = None

    for src in sources:
        name = src["name"]
        url = src["url"]
        zip_bytes = download_zip(url, name)

        # ファイル一覧を取得
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            filenames = zf.namelist()

        for filename in filenames:
            if filename.endswith('/'):
                continue
            header, rows = read_csv_from_zip(zip_bytes, filename)
            if header is None:
                continue

            # agency.txt は同じ内容のはずなので1回だけ採用
            if filename == "agency.txt":
                if agency_header is None:
                    agency_header = header
                    agency_row = rows[0] if rows else None
                continue

            # stops.txt は stop_id で重複排除
            if filename == "stops.txt":
                stop_id_idx = header.index("stop_id")
                for row in rows:
                    if not row:
                        continue
                    stop_id = row[stop_id_idx]
                    if stop_id not in stops_dict:
                        stops_dict[stop_id] = row
                continue

            # その他ファイルはそのまま連結
            if filename not in merged:
                merged[filename] = [header]
            merged[filename].extend(rows)

    # stops.txt を dict からリストに戻す
    if stops_dict:
        # ヘッダーは最初のソースから取得
        header, _ = read_csv_from_zip(download_zip(sources[0]["url"], sources[0]["name"]), "stops.txt")
        if header:
            merged["stops.txt"] = [header] + list(stops_dict.values())

    # agency.txt を追加
    if agency_header and agency_row:
        merged["agency.txt"] = [agency_header, agency_row]

    return merged


def write_gtfs(merged, output_dir):
    """統合されたGTFSデータを指定フォルダに書き出す"""
    os.makedirs(output_dir, exist_ok=True)
    for filename, rows in merged.items():
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        print(f"  ✓ {filename} を書き出しました（{len(rows)-1}行）")


def process_single(bus, dest_folder):
    """通常の単一路線GTFSをダウンロード・解凍"""
    name = bus["name"]
    url = bus["url"]
    print(f"【{name}】処理中...")

    try:
        os.makedirs(dest_folder, exist_ok=True)
        zip_bytes = download_zip(url, name)

        print(f"  → {dest_folder} へ解凍中...")
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zip_ref:
            zip_ref.extractall(dest_folder)

        print(f"  ✨ {name} の展開が完了しました。")
    except Exception as e:
        print(f"  ❌ エラーが発生しました（スキップします）: {e}")


def main():
    print("🚌 運行データの一括自動処理を開始します...\n")

    # 1. 通常のバス会社を個別フォルダに解凍
    for bus in BUS_DATA_LIST:
        dest_folder = os.path.join(TARGET_BASE_DIR, bus["name"])
        process_single(bus, dest_folder)
        print("-" * 40)

    # 2. 大竹市3路線を統合
    print("【ohtake】大竹市3路線を統合中...")
    try:
        merged = merge_gtfs_files(OHTAKE_SOURCES)
        ohtake_dir = os.path.join(TARGET_BASE_DIR, "ohtake")
        write_gtfs(merged, ohtake_dir)
        print(f"  ✨ ohtake（大竹市統合GTFS）の作成が完了しました。")
    except Exception as e:
        print(f"  ❌ ohtake統合中にエラーが発しました: {e}")

    print("\n🎉 すべてのバス会社の自動処理が終了しました！")


if __name__ == "__main__":
    main()
