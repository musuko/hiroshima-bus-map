import os
import zipfile
import shutil

# 【設定】ダウンロードフォルダと、GTFSを配置したいフォルダのパス
DOWNLOAD_DIR = r"D:\Users\Downloads"
TARGET_DIR = r"D:\Users\Downloads\current_data\info"

# 自動処理したいZIPファイルと、作成するフォルダ名のセット
# (ここに対応させたいバス会社をどんどん追加できます)
BUS_COMPANIES = {
    "hiroden.zip": "hiroden",
    "hirobus.zip": "hirobus",
    "geiyo.zip": "geiyo",
    "hiroko.zip": "hiroko"
}

def organize_gtfs():
    for zip_name, folder_name in BUS_COMPANIES.items():
        zip_path = os.path.join(DOWNLOAD_DIR, zip_name)
        
        # 1. ダウンロードフォルダにZIPファイルがあるか確認
        if os.path.exists(zip_path):
            print(f"【発見】{zip_name} の処理を開始します...")
            
            # 2. 移動先のフォルダ（info/バス会社名）を自動作成
            dest_folder = os.path.join(TARGET_DIR, folder_name)
            os.makedirs(dest_folder, exist_ok=True)
            
            # 3. ZIPファイルをそのフォルダに解凍
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(dest_folder)
            
            print(f"  → 解凍して {dest_folder} に配置しました。")
            
            # 4. 使い終わった元のZIPファイルを削除（またはゴミ箱へ）
            os.remove(zip_path)
            print(f"  → 元の {zip_name} を削除しました。")
            
    print("\nすべての自動整理が完了しました！")

if __name__ == "__main__":
    organize_gtfs()
