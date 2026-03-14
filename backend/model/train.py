import sys
import os
sys.path.append(os.path.dirname(__file__))

import json
import torch
import torch.nn.functional as F
from dataset import build_pyg_graph
from gnn import FraudGNN

# Build graph from PaySim data
data, id_to_idx, accounts = build_pyg_graph()

n = data.num_nodes
perm = torch.randperm(n)
train_mask = torch.zeros(n, dtype=torch.bool)
test_mask  = torch.zeros(n, dtype=torch.bool)
train_mask[perm[:int(n * 0.8)]] = True
test_mask[perm[int(n * 0.8):]]  = True

# Boost fraud class — it's rare so we weight it higher
fraud_count  = int(data.y.sum())
normal_count = n - fraud_count
weight = torch.tensor([1.0, normal_count / max(fraud_count, 1)])
print(f"Class weights: normal=1.0, fraud={weight[1]:.1f}")

model     = FraudGNN()
optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4)

def train():
    model.train()
    optimizer.zero_grad()
    out  = model(data.x, data.edge_index)
    loss = F.nll_loss(out[train_mask], data.y[train_mask], weight=weight)
    loss.backward()
    optimizer.step()
    return loss.item()

@torch.no_grad()
def evaluate():
    model.eval()
    out  = model(data.x, data.edge_index)
    pred = out.argmax(dim=1)
    correct = (pred[test_mask] == data.y[test_mask]).sum()
    return int(correct) / int(test_mask.sum())

print("Training GNN...")
for epoch in range(1, 201):
    loss = train()
    if epoch % 20 == 0:
        acc = evaluate()
        print(f"Epoch {epoch:03d} | Loss: {loss:.4f} | Test Acc: {acc:.4f}")

# Save model weights
save_dir = os.path.dirname(__file__)
torch.save(model.state_dict(), os.path.join(save_dir, "fraud_gnn.pt"))
print("Model saved → model/fraud_gnn.pt")

# Export per-account risk scores
model.eval()
with torch.no_grad():
    out   = model(data.x, data.edge_index)
    probs = torch.exp(out)[:, 1].tolist()

scores = {accounts[i]["id"]: round(probs[i], 4) for i in range(len(accounts))}
with open(os.path.join(save_dir, "scores.json"), "w") as f:
    json.dump(scores, f)
print("Scores saved → model/scores.json")