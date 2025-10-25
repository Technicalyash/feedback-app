    import os
    from datetime import datetime
    from collections import Counter
    from flask import Flask, render_template, request, jsonify
    from pymongo import MongoClient
    from bson.json_util import dumps
    from textblob import TextBlob
    from nrclex import NRCLex

    # ---------- CONFIG ----------
    # Local MongoDB
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "feedback_app")
    COLLECTION_NAME = os.environ.get("COLLECTION_NAME", "feedbacks")

    # ---------- APP & DB ----------
    app = Flask(__name__, static_folder="static", template_folder="templates")
    client = MongoClient(MONGO_URI)
    db = client.get_database(DB_NAME)
    collection = db[COLLECTION_NAME]

    # ---------- Helpers ----------
    def analyze_sentiment(text: str):
        blob = TextBlob(text)
        score = blob.sentiment.polarity
        if score > 0.1:
            label = "positive"
        elif score < -0.1:
            label = "negative"
        else:
            label = "neutral"
        return {"score": float(score), "label": label}

    def detect_emotion(text: str):
        if not text:
            return "neutral"
        emo = NRCLex(text)
        scores = emo.raw_emotion_scores
        if not scores:
            return "neutral"
        top = max(scores.items(), key=lambda x: x[1])[0]
        return top

    def extract_keywords(text: str, max_kw=8):
        blob = TextBlob(text)
        phrases = [p.lower() for p in blob.noun_phrases]
        if not phrases:
            words = [w.lower().strip(".,!?:;()[]") for w in text.split() if len(w) > 3]
            counts = Counter(words)
            return [k for k,_ in counts.most_common(max_kw)]
        counts = Counter(phrases)
        return [k for k,_ in counts.most_common(max_kw)]

    # ---------- Routes ----------
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/dashboard")
    def dashboard():
        return render_template("dashboard.html")

    @app.route("/submit", methods=["POST"])
    def submit_feedback():
        payload = request.get_json(force=True)
        name = (payload.get("name") or "").strip()
        email = (payload.get("email") or "").strip()
        feedback_text = (payload.get("feedback") or "").strip()
        rating = payload.get("rating") or 0

        if not name or not email or not feedback_text:
            return jsonify({"status":"error","message":"name, email and feedback required"}), 400

        try:
            rating = int(rating)
        except:
            rating = 0

        sentiment = analyze_sentiment(feedback_text)
        emotion = detect_emotion(feedback_text)
        keywords = extract_keywords(feedback_text)

        doc = {
            "name": name,
            "email": email,
            "feedback": feedback_text,
            "rating": rating,
            "sentiment_score": sentiment["score"],
            "sentiment_label": sentiment["label"],
            "emotion": emotion,
            "keywords": keywords,
            "created_at": datetime.utcnow()
        }

        collection.insert_one(doc)

        return jsonify({
            "status":"success",
            "sentiment": sentiment["label"],
            "emotion": emotion,
            "keywords": keywords
        }), 201

    @app.route("/get_feedback_counts")
    def get_feedback_counts():
        pipeline = [{"$group": {"_id": "$sentiment_label", "count": {"$sum": 1}}}]
        res = list(collection.aggregate(pipeline))
        counts = {r["_id"]: r["count"] for r in res}
        return jsonify({
            "positive": int(counts.get("positive",0)),
            "neutral": int(counts.get("neutral",0)),
            "negative": int(counts.get("negative",0))
        })

    @app.route("/get_emotion_counts")
    def get_emotion_counts():
        pipeline = [{"$group": {"_id": "$emotion", "count": {"$sum": 1}}}]
        res = list(collection.aggregate(pipeline))
        return jsonify({r["_id"] or "unknown": int(r["count"]) for r in res})

    @app.route("/get_top_keywords")
    def get_top_keywords():
        pipeline = [
            {"$unwind":"$keywords"},
            {"$group":{"_id":"$keywords","count":{"$sum":1}}},
            {"$sort":{"count":-1}},
            {"$limit":20}
        ]
        res = list(collection.aggregate(pipeline))
        return jsonify([{ "keyword": r["_id"], "count": int(r["count"]) } for r in res])

    @app.route("/get_feedback")
    def get_feedback():
        feedbacks = list(collection.find().sort("created_at", -1).limit(20))
        return dumps(feedbacks)

    # ---------- Run ----------
    if __name__ == "__main__":
        port = int(os.environ.get("PORT",5000))
        app.run(host="0.0.0.0", port=port, debug=True)
