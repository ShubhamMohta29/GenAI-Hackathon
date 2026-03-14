import json
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "graph_data.json")

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

def load_graph():
    with open(DATA_PATH) as f:
        data = json.load(f)

    accounts = data["accounts"]
    transactions = data["transactions"]

    print(f"Loading {len(accounts)} accounts and {len(transactions)} transactions into Neo4j...")

    with driver.session() as s:
        # Clear existing data
        s.run("MATCH (n) DETACH DELETE n")
        print("Cleared existing graph.")

        # Load accounts in batches of 100
        for i in range(0, len(accounts), 100):
            batch = accounts[i:i+100]
            s.run("""
                UNWIND $batch AS a
                MERGE (acc:Account {id: a.id})
                SET acc.is_fraud = a.is_fraud,
                    acc.risk_score = 0.0
            """, batch=batch)

        print(f"Loaded {len(accounts)} account nodes.")

        # Load transactions in batches of 100
        for i in range(0, len(transactions), 100):
            batch = transactions[i:i+100]
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

    print("Graph loaded successfully into Neo4j.")
    driver.close()

if __name__ == "__main__":
    load_graph()