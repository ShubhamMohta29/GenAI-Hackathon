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

    # Keep only TRANSFER and CASH_OUT where fraud occurs
    df = df[df["type"].isin(["TRANSFER", "CASH_OUT"])]
    print(f"Filtered to {len(df)} transactions")

    # Get unique accounts
    all_ids = np.unique(np.concatenate((df["nameOrig"].unique(), df["nameDest"].unique())))
    fraud_accounts = set(
        df[df["isFraud"] == 1]["nameOrig"].tolist() +
        df[df["isFraud"] == 1]["nameDest"].tolist()
    )

    print(f"Loading {len(all_ids)} accounts into Neo4j...")

    with driver.session() as s:
        s.run("MATCH (n) DETACH DELETE n")
        print("Cleared existing graph.")

        # Load accounts in batches
        accounts = [
            {"id": str(aid), "is_fraud": str(aid) in fraud_accounts}
            for aid in all_ids
        ]
        for i in range(0, len(accounts), 500):
            batch = accounts[i:i+500]
            s.run("""
                UNWIND $batch AS a
                MERGE (acc:Account {id: a.id})
                SET acc.is_fraud = a.is_fraud,
                    acc.risk_score = 0.0
            """, batch=batch)
        print(f"Loaded {len(accounts)} account nodes.")

        # Load transactions in batches
        transactions = [
            {
                "id": f"tx_{idx}",
                "src": str(row["nameOrig"]),
                "dst": str(row["nameDest"]),
                "amount": float(row["amount"]),
                "type": row["type"],
                "is_fraud": bool(row["isFraud"])
            }
            for idx, row in df.iterrows()
        ]
        for i in range(0, len(transactions), 500):
            batch = transactions[i:i+500]
            s.run("""
                UNWIND $batch AS t
                MATCH (src:Account {id: t.src})
                MATCH (dst:Account {id: t.dst})
                MERGE (src)-[tx:SENT {id: t.id}]->(dst)
                SET tx.amount = t.amount,
                    tx.type = t.type,
                    tx.is_fraud = t.is_fraud
            """, batch=batch)
        print(f"Loaded {len(transactions)} transaction edges.")

    print("Done loading graph into Neo4j.")
    driver.close()

if __name__ == "__main__":
    load_graph()