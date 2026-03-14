import json
import os
import torch
from torch_geometric.data import Data

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "graph_data.json")

def build_pyg_graph():
    with open(DATA_PATH) as f:
        raw = json.load(f)

    accounts = raw["accounts"]
    transactions = raw["transactions"]

    # Map account id -> index number
    id_to_idx = {a["id"]: i for i, a in enumerate(accounts)}

    # Node features: just a single feature (1.0) for now
    # The GNN will learn from graph structure, not node attributes
    x = torch.ones((len(accounts), 1), dtype=torch.float)

    # Labels: 1 = fraud, 0 = normal
    y = torch.tensor(
        [int(a.get("is_fraud", False)) for a in accounts],
        dtype=torch.long
    )

    # Build edge list
    edge_index = []
    edge_attr = []

    for t in transactions:
        src_idx = id_to_idx.get(t["src"])
        dst_idx = id_to_idx.get(t["dst"])
        if src_idx is not None and dst_idx is not None:
            edge_index.append([src_idx, dst_idx])
            edge_attr.append([t["amount"] / 1_000_000.0])  # normalize

    edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
    edge_attr = torch.tensor(edge_attr, dtype=torch.float)

    data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)

    print(f"Graph: {data.num_nodes} nodes, {data.num_edges} edges")
    print(f"Fraud nodes: {y.sum().item()} / {len(y)}")

    return data, id_to_idx, accounts

if __name__ == "__main__":
    build_pyg_graph()