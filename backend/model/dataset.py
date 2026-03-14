# import os
# import sys
# import numpy as np
# import pandas as pd
# import torch
# from sklearn.preprocessing import StandardScaler
# from torch_geometric.data import Data
#
# sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "data"))
# from generate_data import DATA_DIR, DATASET, get_kaggle_dataset
#
# def build_pyg_graph(sample_size=100000):
#     csv_path = get_kaggle_dataset(DATASET, DATA_DIR)
#     if not csv_path:
#         raise FileNotFoundError("Could not find or download the dataset.")
#
#     print("Loading dataset into Pandas...")
#     df = pd.read_csv(csv_path, nrows=sample_size)
#     print(f"Loaded {len(df)} transactions.")
#
#     # Map account names to integer node IDs
#     print("Extracting Node IDs...")
#     all_nodes = np.unique(np.concatenate((df['nameOrig'].unique(), df['nameDest'].unique())))
#     node_mapping = {name: idx for idx, name in enumerate(all_nodes)}
#     num_nodes = len(all_nodes)
#     print(f"Total unique accounts (Nodes): {num_nodes}")
#
#     df['src_id'] = df['nameOrig'].map(node_mapping)
#     df['dst_id'] = df['nameDest'].map(node_mapping)
#
#     # Edge index
#     print("Building Edge Index...")
#     edge_index = torch.tensor(
#         np.array([df['src_id'].values, df['dst_id'].values]),
#         dtype=torch.long
#     )
#
#     # Node features: sent_count, sent_sum, received_count, received_sum
#     print("Engineering Node Features...")
#     out_features = df.groupby('src_id')['amount'].agg(['count', 'sum']).reset_index()
#     in_features  = df.groupby('dst_id')['amount'].agg(['count', 'sum']).reset_index()
#
#     x = np.zeros((num_nodes, 4), dtype=np.float32)
#     x[out_features['src_id'].values, 0] = out_features['count'].values
#     x[out_features['src_id'].values, 1] = out_features['sum'].values
#     x[in_features['dst_id'].values,  2] = in_features['count'].values
#     x[in_features['dst_id'].values,  3] = in_features['sum'].values
#
#     scaler = StandardScaler()
#     x = torch.tensor(scaler.fit_transform(x), dtype=torch.float32)
#
#     # Edge features
#     print("Engineering Edge Features...")
#     df = pd.get_dummies(df, columns=['type'], prefix='type', dtype=float)
#     for col in ['type_CASH_IN','type_CASH_OUT','type_DEBIT','type_PAYMENT','type_TRANSFER']:
#         if col not in df.columns:
#             df[col] = 0.0
#
#     edge_cols = [
#         'amount', 'oldbalanceOrg', 'newbalanceOrig',
#         'oldbalanceDest', 'newbalanceDest',
#         'type_CASH_IN','type_CASH_OUT','type_DEBIT','type_PAYMENT','type_TRANSFER'
#     ]
#     edge_attr = torch.tensor(
#         scaler.fit_transform(df[edge_cols].values),
#         dtype=torch.float32
#     )
#
#     # Labels (per edge)
#     print("Extracting labels...")
#     y = torch.tensor(df['isFraud'].values, dtype=torch.long)
#
#     # Assemble graph
#     print("Assembling PyTorch Data object...")
#     graph_data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)
#
#     print(f"\n--- Final Graph ---")
#     print(f"Nodes:          {graph_data.num_nodes}")
#     print(f"Edges:          {graph_data.num_edges}")
#     print(f"Node features:  {graph_data.x.shape[1]}")
#     print(f"Edge features:  {graph_data.edge_attr.shape[1]}")
#
#     # Save to disk
#     save_path = os.path.join(DATA_DIR, "paysim_graph.pt")
#     torch.save(graph_data, save_path)
#     print(f"Saved graph to: {save_path}")
#
#     return graph_data, node_mapping, all_nodes
#
# if __name__ == "__main__":
#     build_pyg_graph(sample_size=100000)
import os
import sys
import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import Data

# Fix path so generate_data can be found both by Python and the IDE
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data")
sys.path.insert(0, os.path.abspath(DATA_PATH))

try:
    from generate_data import DATA_DIR, DATASET, get_kaggle_dataset
except ImportError as e:
    raise ImportError(f"Could not import generate_data. Check your folder structure. Error: {e}")

def build_pyg_graph(sample_size=100000):
    csv_path = get_kaggle_dataset(DATASET, DATA_DIR)
    if not csv_path:
        raise FileNotFoundError("Could not find or download the dataset.")

    print("Loading dataset into Pandas...")
    df = pd.read_csv(csv_path, nrows=sample_size)
    print(f"Loaded {len(df)} transactions.")

    print("Extracting Node IDs...")
    all_nodes = np.unique(np.concatenate((df['nameOrig'].unique(), df['nameDest'].unique())))
    node_mapping = {name: idx for idx, name in enumerate(all_nodes)}
    num_nodes = len(all_nodes)
    print(f"Total unique accounts (Nodes): {num_nodes}")

    df['src_id'] = df['nameOrig'].map(node_mapping)
    df['dst_id'] = df['nameDest'].map(node_mapping)

    print("Building Edge Index...")
    edge_index = torch.tensor(
        np.array([df['src_id'].values, df['dst_id'].values]),
        dtype=torch.long
    )

    print("Engineering Node Features...")
    out_features = df.groupby('src_id')['amount'].agg(['count', 'sum']).reset_index()
    in_features  = df.groupby('dst_id')['amount'].agg(['count', 'sum']).reset_index()

    x = np.zeros((num_nodes, 4), dtype=np.float32)
    x[out_features['src_id'].values, 0] = out_features['count'].values
    x[out_features['src_id'].values, 1] = out_features['sum'].values
    x[in_features['dst_id'].values,  2] = in_features['count'].values
    x[in_features['dst_id'].values,  3] = in_features['sum'].values

    scaler = StandardScaler()
    x = torch.tensor(scaler.fit_transform(x), dtype=torch.float32)

    print("Engineering Edge Features...")
    df = pd.get_dummies(df, columns=['type'], prefix='type', dtype=float)
    for col in ['type_CASH_IN','type_CASH_OUT','type_DEBIT','type_PAYMENT','type_TRANSFER']:
        if col not in df.columns:
            df[col] = 0.0

    edge_cols = [
        'amount', 'oldbalanceOrg', 'newbalanceOrig',
        'oldbalanceDest', 'newbalanceDest',
        'type_CASH_IN','type_CASH_OUT','type_DEBIT','type_PAYMENT','type_TRANSFER'
    ]
    edge_attr = torch.tensor(
        scaler.fit_transform(df[edge_cols].values),
        dtype=torch.float32
    )

    print("Extracting labels...")
    y = torch.tensor(df['isFraud'].values, dtype=torch.long)

    print("Assembling PyTorch Data object...")
    graph_data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)

    print(f"\n--- Final Graph ---")
    print(f"Nodes:          {graph_data.num_nodes}")
    print(f"Edges:          {graph_data.num_edges}")
    print(f"Node features:  {graph_data.x.shape[1]}")
    print(f"Edge features:  {graph_data.edge_attr.shape[1]}")

    save_path = os.path.join(DATA_DIR, "paysim_graph.pt")
    torch.save(graph_data, save_path)
    print(f"Saved graph to: {save_path}")

    return graph_data, node_mapping, all_nodes

if __name__ == "__main__":
    build_pyg_graph(sample_size=100000)
