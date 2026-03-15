import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "data"))

import json
import torch
import torch.nn.functional as F
from dataset import build_pyg_graph
from gnn import FraudGNN

from sklearn.metrics import classification_report

# Build graph, uses 100k rows for speed
data, node_mapping, all_nodes = build_pyg_graph(sample_size=100000)

n = data.num_nodes

# Labels are per-EDGE in this dataset (isFraud is per transaction)
# We need per-NODE labels — a node is fraud if any of its edges are fraud
print("Building per-node fraud labels...")
fraud_edge_mask = data.y.bool()
fraud_nodes = set()
fraud_src = data.edge_index[0][fraud_edge_mask].tolist()
fraud_dst = data.edge_index[1][fraud_edge_mask].tolist()
fraud_nodes.update(fraud_src)
fraud_nodes.update(fraud_dst)

node_labels = torch.zeros(n, dtype=torch.long)
for idx in fraud_nodes:
    node_labels[idx] = 1

print(f"Fraud nodes: {node_labels.sum().item()} / {n}")

# Train/test split
perm       = torch.randperm(n)
train_mask = torch.zeros(n, dtype=torch.bool)
test_mask  = torch.zeros(n, dtype=torch.bool)
train_mask[perm[:int(n * 0.8)]] = True
test_mask[perm[int(n * 0.8):]]  = True

# Class weights to handle imbalance
fraud_count  = int(node_labels.sum())
normal_count = n - fraud_count
weight = torch.tensor([1.0, normal_count / max(fraud_count, 1)])
print(f"Class weights: normal=1.0, fraud={weight[1]:.1f}")

# Model — in_channels matches node feature count from dataset.py (4 features)
model     = FraudGNN(in_channels=data.x.shape[1], hidden=64, out_channels=2)
optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4)

def train():
    model.train()
    optimizer.zero_grad()
    out  = model(data.x, data.edge_index)
    loss = F.nll_loss(out[train_mask], node_labels[train_mask], weight=weight)
    loss.backward()
    optimizer.step()
    return loss.item()

from sklearn.metrics import precision_score, recall_score, f1_score

@torch.no_grad()
def evaluate():
    model.eval()
    out  = model(data.x, data.edge_index)
    pred = out.argmax(dim=1)
    
    # Calculate Precision, Recall, F1 on the test set
    y_true = node_labels[test_mask].numpy()
    y_pred = pred[test_mask].numpy()
    
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    return prec, rec, f1

print("Training GNN...")
for epoch in range(1, 201):
    loss = train()
    if epoch % 20 == 0:
        prec, rec, f1 = evaluate()
        print(f"Epoch {epoch:03d} | Loss: {loss:.4f} | Prec: {prec:.4f} | Rec: {rec:.4f} | F1: {f1:.4f}")

# Save model
save_dir = os.path.dirname(__file__)
torch.save(model.state_dict(), os.path.join(save_dir, "fraud_gnn.pt"))
print("Model saved → model/fraud_gnn.pt")

# Final evaluation and classification report
model.eval()
with torch.no_grad():
    out   = model(data.x, data.edge_index)
    pred  = out.argmax(dim=1)
    probs = torch.exp(out)[:, 1].tolist()
print(classification_report(node_labels[test_mask], pred[test_mask], target_names=["normal", "fraud"]))

# Export per-node risk scores
scores = {str(all_nodes[i]): round(probs[i], 4) for i in range(len(probs))}

with open(os.path.join(save_dir, "scores.json"), "w") as f:
    json.dump(scores, f)
print(f"Scores saved → model/scores.json ({len(scores)} accounts)")
