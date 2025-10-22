// Clickable Star Rating
const stars = document.querySelectorAll(".rating span");
let rating = 0;

stars.forEach((star, index) => {
  star.addEventListener("mouseover", () => {
    stars.forEach((s, i) => s.style.color = i <= index ? "#F5A623" : "#ccc");
  });

  star.addEventListener("click", () => {
    rating = index + 1;
  });

  star.addEventListener("mouseout", () => {
    stars.forEach((s, i) => s.style.color = i < rating ? "#F5A623" : "#ccc");
  });
});

// Form Submit with Spinner, Success & Sentiment Display
const form = document.getElementById('feedbackForm');
const spinner = document.getElementById('spinner');
const success = document.getElementById('success');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  spinner.style.display = 'block';

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  data.rating = rating; // add star rating

  const res = await fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  spinner.style.display = 'none';
  success.style.display = 'block';
  success.innerText = `✔ Feedback Submitted! Sentiment: ${result.sentiment.toUpperCase()}`;

  setTimeout(() => { success.style.display = 'none'; }, 4000);
  form.reset();
  rating = 0;
  stars.forEach(s => s.style.color = "#ccc");
});

// Chart.js Dashboard
const ctx = document.getElementById('sentimentChart');
let sentimentChart;

if(ctx){
  sentimentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        label: 'Feedback Count',
        data: [0,0,0],
        backgroundColor: ['#4CAF50','#FFC107','#F44336']
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 1000 },
    }
  });

  // Real-time update example
  setInterval(async () => {
    const res = await fetch('/get_feedback_counts');
    const data = await res.json();
    sentimentChart.data.datasets[0].data = [data.positive, data.neutral, data.negative];
    sentimentChart.update();
  }, 5000);
}

// Optional: Render feedback cards
async function loadFeedbackCards(){
  const res = await fetch('/get_feedback');
  const feedbacks = await res.json();
  const container = document.getElementById('feedbackCards');
  container.innerHTML = '';
  feedbacks.forEach(f => {
    const div = document.createElement('div');
    div.className = 'feedback-card';
    div.innerHTML = `<strong>${f.name}</strong> (${f.rating}⭐)<br>${f.feedback}`;
    container.appendChild(div);
  });
}
setInterval(loadFeedbackCards, 5000);
