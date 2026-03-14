import os
import sys
import numpy as np
import pandas as pd
from neo4j import GraphDatabase
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "data"))
from generate_data import get_kaggle_dataset, DATASET, DATA_DIR

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

def load_graph(sample_size=100000):
    csv_path = get_kaggle_dataset(DATASET, DATA_DIR)
    if not csv_path:
        raise FileNotFoundError("Dataset not found.")

    print(f"Loading {sample_size} rows from CSV...")
    df = pd.read_csv(csv_path, nrows=sample_size)
    df = df[df["type"].isin(["TRANSFER", "CASH_OUT"])]
    print(f"Filtered to {len(df)} transactions")

    all_ids = np.unique(np.concatenate((
        df["nameOrig"].unique(),
        df["nameDest"].unique()
    )))

    fraud_accounts = set(
        df[df["isFraud"] == 1]["nameOrig"].tolist() +
        df[df["isFraud"] == 1]["nameDest"].tolist()
    )

    print(f"Loading {len(all_ids)} accounts into Neo4j...")

    with driver.session() as s:
        # Clear
        s.run("MATCH (n) DETACH DELETE n")
        print("Cleared existing graph.")

        # Create index first — makes MATCH fast
        s.run("CREATE INDEX account_id IF NOT EXISTS FOR (a:Account) ON (a.id)")
        print("Index created.")

        # Load accounts in batches of 1000
        accounts = [
            {"id": str(aid), "is_fraud": str(aid) in fraud_accounts}
            for aid in all_ids
        ]
        for i in range(0, len(accounts), 1000):
            batch = accounts[i:i+1000]
            s.run("""
                UNWIND $batch AS a
                CREATE (acc:Account {id: a.id, is_fraud: a.is_fraud, risk_score: 0.0})
            """, batch=batch)
            print(f"  Accounts: {min(i+1000, len(accounts))}/{len(accounts)}", end="\r")

        print(f"\nLoaded {len(accounts)} account nodes.")

        # Load transactions using MATCH with index — much faster
        transactions = []
        for idx, row in df.iterrows():
            transactions.append({
                "src": str(row["nameOrig"]),
                "dst": str(row["nameDest"]),
                "amount": float(row["amount"]),
                "type": str(row["type"]),
                "is_fraud": bool(row["isFraud"])
            })

        for i in range(0, len(transactions), 1000):
            batch = transactions[i:i+1000]
            s.run("""
                UNWIND $batch AS t
                MATCH (src:Account {id: t.src})
                MATCH (dst:Account {id: t.dst})
                CREATE (src)-[:SENT {
                    amount: t.amount,
                    type: t.type,
                    is_fraud: t.is_fraud
                }]->(dst)
            """, batch=batch)
            print(f"  Transactions: {min(i+1000, len(transactions))}/{len(transactions)}", end="\r")

        print(f"\nLoaded {len(transactions)} transaction edges.")

    print("Done.")
    driver.close()

if __name__ == "__main__":
    load_graph()