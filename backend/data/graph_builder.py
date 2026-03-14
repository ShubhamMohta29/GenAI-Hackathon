import os
import networkx as nx
import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import Data
import pandas as pd
from generate_data import DATA_DIR, DATASET, get_kaggle_dataset

def build_pyg_graph(sample_size=None):
    """
    Loads the PaySim dataset and constructs a PyTorch Geometric (PyG) Directed Graph.
    Nodes = Accounts (Customers and Merchants)
    Edges = Transactions
    
    Returns: PyG Data object ready for GNN training.
    """
    csv_path = get_kaggle_dataset(DATASET, DATA_DIR)
    if not csv_path:
        raise FileNotFoundError("Could not find or download the dataset.")
        
    print("Loading dataset into Pandas...")
    df = pd.read_csv(csv_path, nrows=sample_size)
    print(f"Loaded {len(df)} transactions.")
    
    # --- 1. Map Strings to Integer Node IDs ---
    print("Extracting Node IDs...")
    unique_orig = df['nameOrig'].unique()
    unique_dest = df['nameDest'].unique()
    all_nodes = np.unique(np.concatenate((unique_orig, unique_dest)))
    
    # Create an extremely fast lookup dictionary mapping {"C123..": 0, "M456..": 1}
    node_mapping = {name: idx for idx, name in enumerate(all_nodes)}
    num_nodes = len(all_nodes)
    print(f"Total unique accounts (Nodes): {num_nodes}")

    # Map the edges in the dataframe to these integers
    df['src_id'] = df['nameOrig'].map(node_mapping)
    df['dst_id'] = df['nameDest'].map(node_mapping)

    # --- 2. Build Edge Index Tensor [2, num_edges] ---
    print("Building Edge Index...")
    edge_index = torch.tensor(
        np.array([df['src_id'].values, df['dst_id'].values]),
        dtype=torch.long
    )

    # --- 3. Build Node Features Tensor ---
    # Since PaySim doesn't give us demographics (age, location), we must ENGINEER them.
    print("Engineering Node Features...")
    # Feature 1: Default node features can just be dummy ones if nothing else exists, 
    # but we will calculate Out-Degree and In-Degree transaction totals.
    
    # Calculate transaction sums and counts per node
    out_features = df.groupby('src_id')['amount'].agg(['count', 'sum']).reset_index()
    in_features  = df.groupby('dst_id')['amount'].agg(['count', 'sum']).reset_index()
    
    # Initialize blank feature matrix: [num_nodes, 4 features]
    # Features = [sent_count, sent_sum, received_count, received_sum]
    x = np.zeros((num_nodes, 4), dtype=np.float32)
    
    # Populate the known senders
    x[out_features['src_id'].values, 0] = out_features['count'].values
    x[out_features['src_id'].values, 1] = out_features['sum'].values
    
    # Populate the known recipients
    x[in_features['dst_id'].values, 2] = in_features['count'].values
    x[in_features['dst_id'].values, 3] = in_features['sum'].values

    # Scale the features (Neural networks hate raw $1,000,000 values next to small counts)
    scaler = StandardScaler()
    x = scaler.fit_transform(x)
    x = torch.tensor(x, dtype=torch.float32)

    # --- 4. Build Edge Features Tensor ---
    print("Engineering Edge Features...")
    # One-hot encode the categorical 'type' column
    df = pd.get_dummies(df, columns=['type'], prefix='type', dtype=float)
    
    # All features going into the edge
    edge_cols = [
        'amount', 'oldbalanceOrg', 'newbalanceOrig', 
        'oldbalanceDest', 'newbalanceDest', 
        'type_CASH_IN', 'type_CASH_OUT', 'type_DEBIT', 'type_PAYMENT', 'type_TRANSFER'
    ]
    
    # Ensure missing Dummy columns are filled with 0 if using a small sample
    for col in [
        'type_CASH_IN', 'type_CASH_OUT', 'type_DEBIT', 'type_PAYMENT', 'type_TRANSFER'
    ]:
        if col not in df.columns:
            df[col] = 0.0
            
    # Scale edge amounts/balances
    edge_attr = df[edge_cols].values
    edge_attr = scaler.fit_transform(edge_attr)
    edge_attr = torch.tensor(edge_attr, dtype=torch.float32)

    # --- 5. Build Labels ---
    print("Extracting labels...")
    y = torch.tensor(df['isFraud'].values, dtype=torch.long)

    # --- 6. Construct PyTorch Geometric Graph! ---
    print("Assembling PyTorch Data object...")
    graph_data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)
    
    print("\n--- Final Graph Tensor ---")
    print(graph_data)
    print(f"Nodes: {graph_data.num_nodes}")
    print(f"Edges: {graph_data.num_edges}")
    print(f"Node Features (x): {graph_data.x.shape[1]}")
    print(f"Edge Features (edge_attr): {graph_data.edge_attr.shape[1]}")
    
    # Save the processed tensor graph to disk
    save_path = os.path.join(DATA_DIR, "paysim_graph.pt")
    torch.save(graph_data, save_path)
    print(f"Saved PyTorch Geometric graph to: {save_path}")
    
    return graph_data

if __name__ == "__main__":
    # Test on a small sample. Remove sample_size=100000 to compile the full 6-million row graph!
    graph = build_pyg_graph(sample_size=100000)

