import os
import glob
import pandas as pd

# Define paths and the dataset you want to download
DATA_DIR = os.path.join(os.path.dirname(__file__), "raw_data")
DATASET = "ealaxi/paysim1" 

def get_kaggle_dataset(dataset_name, download_dir):
    os.makedirs(download_dir, exist_ok=True)
    
    # Check if we already have a CSV file locally
    csv_files = glob.glob(os.path.join(download_dir, "*.csv"))
    if csv_files:
        print(f"Found existing dataset: {csv_files[0]}")
        return csv_files[0]
        
    print(f"Csv not found locally. Downloading '{dataset_name}' from Kaggle...")
    
    try:
        # Import inside the try/except loop so missing packages give a clean error
        from kaggle.api.kaggle_api_extended import KaggleApi
        api = KaggleApi()
        api.authenticate()
        
        # Download and unzip directly into the raw_data directory
        api.dataset_download_files(dataset_name, path=download_dir, unzip=True)
        print("Download and extraction complete.")
        
        # Check again for the extracted CSV
        csv_files = glob.glob(os.path.join(download_dir, "*.csv"))
        if csv_files:
            return csv_files[0]
        else:
            raise FileNotFoundError("Dataset downloaded but no CSV file was found inside.")
            
    except Exception as e:
        print(f"Failed to download dataset: {e}")
        print("Please ensure you have placed your API token at ~/.kaggle/kaggle.json")
        return None

# Load the data
csv_path = get_kaggle_dataset(DATASET, DATA_DIR)
if csv_path:
    print("Loading dataset into pandas...")
    data = pd.read_csv(csv_path)
    
    # Example output to verify it works
    print(data.head())
    print(f"Dataset loaded successfully with shape: {data.shape}")