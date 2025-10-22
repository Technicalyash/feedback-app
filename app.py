from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
from bson.json_util import dumps
from textblob import TextBlob  # For sentiment analysis

app = Flask(__name__)

# --- Connect to MongoDB ---
MONGO_URI = "mongodb+srv://yashlinkedin5_db_user:6MRNgYqklnXZFDaa@cluster0.ohsotas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(MONGO_URI)
db = client.get_database("feedback_app")
feedback_collection = db.feedbacks

# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/submit', methods=['POST'])
def submit_feedback():
    data = request.get_json()
    feedback_text = data.get("feedback", "")
    
    # --- Sentiment analysis ---
    sentiment_score = TextBlob(feedback_text).sentiment.polarity
    # sentiment_score ranges from -1 (negative) to +1 (positive)
    if sentiment_score > 0.1:
        sentiment_label = "positive"
    elif sentiment_score < -0.1:
        sentiment_label = "negative"
    else:
        sentiment_label = "neutral"

    # Insert feedback into MongoDB
    feedback_collection.insert_one({
        "name": data.get("name"),
        "email": data.get("email"),
        "feedback": feedback_text,
        "rating": int(data.get("rating", 0)),
        "sentiment": sentiment_label
    })
    return jsonify({"status": "success", "sentiment": sentiment_label})

@app.route('/get_feedback_counts')
def get_feedback_counts():
    # Count feedbacks based on sentiment analysis
    positive = feedback_collection.count_documents({"sentiment": "positive"})
    neutral = feedback_collection.count_documents({"sentiment": "neutral"})
    negative = feedback_collection.count_documents({"sentiment": "negative"})
    return jsonify({"positive": positive, "neutral": neutral, "negative": negative})

@app.route('/get_feedback')
def get_feedback():
    feedbacks = list(feedback_collection.find().sort("_id", -1).limit(10))
    return dumps(feedbacks)

# --- Run App ---
if __name__ == "__main__":
    app.run(debug=True)
