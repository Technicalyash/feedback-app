from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient

app = Flask(__name__)

# 🔗 MongoDB connection
client = MongoClient("mongodb+srv://yashlinkedin5_db_user:6MRNgYqklnXZFDaa@cluster0.ohsotas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
db = client["feedback_db"]
collection = db["feedbacks"]

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/submit", methods=["POST"])
def submit_feedback():
    name = request.form.get("name")
    email = request.form.get("email")
    rating = request.form.get("rating")
    feedback = request.form.get("feedback")

    if not name or not email or not feedback:
        return jsonify({"error": "All fields required"}), 400

    # Save feedback
    collection.insert_one({
        "name": name,
        "email": email,
        "rating": rating,
        "feedback": feedback
    })

    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True)
