import requests

SERVER_IP = "100.67.159.186"
PORT = 8000

def query_model(prompt: str):
    response = requests.post(
        f"http://{SERVER_IP}:{PORT}/predict",
        json={"prompt": prompt}
    )
    return response.json()["response"]

if __name__ == "__main__":
    print(query_model("Tell me something cool"))